'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { ReportModal } from '@/components/modals/ReportModal';
import Avatar from '@/components/Avatar';
import type { User } from '@supabase/supabase-js';

interface ChatMessage {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  profiles?: { id: string; nickname: string | null; avatar_url: string | null } | null;
}

const PAGE_SIZE = 100;

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}

interface ChatRoomProps {
  user: User | null;
}

export default function ChatRoom({ user }: ChatRoomProps) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { error, success } = useToast();
  const isFirstLoad = useRef(true);

  // Load messages
  const loadMessages = useCallback(async (before?: string) => {
    const sb = createSupabaseBrowser();
    let query = sb
      .from('chat_messages')
      .select('*, profiles(id, nickname, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data } = await query;
    const sorted = (data ?? []).reverse() as ChatMessage[];

    if (before) {
      setMsgs(prev => [...sorted, ...prev]);
      setHasMore(sorted.length === PAGE_SIZE);
    } else {
      setMsgs(sorted);
      setHasMore(sorted.length === PAGE_SIZE);
    }

    return sorted;
  }, []);

  // Initial load + realtime subscription
  useEffect(() => {
    setLoading(true);
    loadMessages().then(() => {
      setLoading(false);
      isFirstLoad.current = true;
    });

    const sb = createSupabaseBrowser();
    const ch = sb
      .channel('chat_lounge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const nm = payload.new as ChatMessage;
          // Fetch profile for the new message
          const { data: prof } = await sb
            .from('profiles')
            .select('id, nickname, avatar_url')
            .eq('id', nm.user_id!)
            .single();
          setMsgs(prev => [...prev, { ...nm, profiles: prof }]);
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(ch);
    };
  }, [loadMessages]);

  // Auto-scroll only on NEW messages (not initial load)
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return; // 초기 로드 시 스크롤 안 함 — 맨 위부터 보기
    }
    // 새 메시지 도착 시 하단 근처에 있으면 자동 스크롤
    const el = scrollRef.current;
    if (el) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [msgs]);

  // Load more (scroll up)
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || msgs.length === 0) return;
    setLoadingMore(true);
    const oldestMsg = msgs[0];
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    await loadMessages(oldestMsg.created_at);

    // Maintain scroll position
    requestAnimationFrame(() => {
      if (el) {
        el.scrollTop = el.scrollHeight - prevScrollHeight;
      }
    });
    setLoadingMore(false);
  };

  // Scroll handler for load-more
  const handleScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop < 50 && hasMore && !loadingMore) {
      handleLoadMore();
    }
  };

  // Send message
  const send = async () => {
    if (!user) {
      error('로그인이 필요합니다');
      return;
    }
    const t = input.trim();
    if (!t || sending) return;
    if (t.length > 300) {
      error('메시지는 300자까지 입력 가능합니다');
      return;
    }
    setSending(true);
    const sb = createSupabaseBrowser();
    const { error: insertErr } = await sb.from('chat_messages').insert({
      user_id: user.id,
      content: t,
    });
    if (insertErr) {
      error('메시지 전송에 실패했습니다');
    }
    setInput('');
    setSending(false);
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 200px)',
        minHeight: 400,
        maxHeight: 700,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          실시간 채팅
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {msgs.length > 0 ? `${msgs.length}개 메시지` : ''}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {loadingMore && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              이전 메시지 불러오는 중...
            </span>
          </div>
        )}

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              padding: '40px 0',
            }}
          >
            채팅 불러오는 중...
          </div>
        ) : msgs.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              padding: '60px 0',
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            첫 메시지를 남겨보세요!
          </div>
        ) : (
          msgs.map((msg) => {
            const isMine = user?.id === msg.user_id;
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  flexDirection: isMine ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                {/* Avatar - only for others */}
                {!isMine && (
                  <Avatar
                    src={msg.profiles?.avatar_url}
                    nickname={msg.profiles?.nickname}
                    size={32}
                  />
                )}

                <div style={{ maxWidth: '70%', minWidth: 0 }}>
                  {/* Nickname + time - only for others */}
                  {!isMine && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        marginBottom: 3,
                      }}
                    >
                      {msg.profiles?.nickname ?? '사용자'} · {timeAgo(msg.created_at)}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    style={{
                      background: isMine ? 'var(--brand)' : 'var(--bg-hover)',
                      border: isMine
                        ? '1px solid transparent'
                        : '1px solid var(--border)',
                      borderRadius: isMine ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                      padding: '8px 12px',
                      fontSize: 14,
                      color: isMine ? 'var(--text-inverse)' : 'var(--text-primary)',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Time for my messages */}
                  {isMine && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        marginTop: 2,
                        textAlign: 'right',
                      }}
                    >
                      {timeAgo(msg.created_at)}
                    </div>
                  )}

                  {/* Report button for others' messages */}
                  {!isMine && user && (
                    <button
                      onClick={() => setReportTarget(msg.id)}
                      style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 0',
                        marginTop: 2,
                      }}
                    >
                      신고
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
        }}
      >
        {user ? (
          <>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="메시지를 입력하세요 (300자, Enter 전송)"
              maxLength={300}
              aria-label="메시지 입력"
              style={{
                flex: 1,
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              aria-label="메시지 전송"
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: 'var(--brand)',
                color: 'var(--text-inverse)',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                opacity: !input.trim() || sending ? 0.5 : 1,
              }}
            >
              전송
            </button>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              padding: '10px 0',
            }}
          >
            <a
              href="/login"
              style={{ color: 'var(--brand)', textDecoration: 'none' }}
            >
              로그인
            </a>
            하면 채팅에 참여할 수 있습니다
          </div>
        )}
      </div>

      {/* Report modal */}
      {reportTarget && (
        <ReportModal
          targetType="chat"
          targetId={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
