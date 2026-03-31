'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { timeAgo } from '@/lib/format';

interface Msg {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  nickname: string;
  is_mine: boolean;
}

const ROOM = 'lounge';

export default function MiniLounge() {
  const { userId } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sb = createSupabaseBrowser();

  // 최근 메시지 로드 (chat_messages — /discuss ChatRoom과 동일 테이블)
  const loadMessages = useCallback(async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from('chat_messages')
      .select('id, content, created_at, user_id, profiles:user_id(nickname)')
      .eq('room', ROOM)
      .is('parent_id', null)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(15);

    if (data) {
      setMsgs(
        data.reverse().map((m: any) => ({
          id: m.id,
          content: m.content,
          created_at: m.created_at,
          user_id: m.user_id,
          nickname: (m.profiles as any)?.nickname || '익명',
          is_mine: m.user_id === userId,
        }))
      );
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight }), 100);
    }
  }, [userId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 실시간 구독 — chat_messages INSERT (ChatRoom과 동일 채널 패턴)
  useEffect(() => {
    const ch = sb
      .channel('mini-lounge-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          // 새 메시지 도착 시 전체 리로드 (ChatRoom과 동일 방식)
          loadMessages();
        }
      )
      .subscribe();

    return () => { sb.removeChannel(ch); };
  }, [loadMessages]);

  // 메시지 전송 — chat_messages에 INSERT (/discuss ChatRoom과 동일)
  const send = useCallback(async () => {
    if (!input.trim() || !userId || sending) return;
    const text = input.trim();
    if (text.length > 200) return;
    setInput('');
    setSending(true);

    await sb.from('chat_messages').insert({
      user_id: userId,
      content: text,
      room: ROOM,
    });

    setSending(false);
    // realtime이 자동 리로드 트리거
  }, [input, userId, sending, sb]);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22C55E',
            boxShadow: '0 0 6px rgba(34,197,94,0.5)',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>라운지</span>
          {msgs.length > 0 && (
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{msgs.length}</span>
          )}
        </div>
        <Link href="/discuss" style={{
          fontSize: 9, color: 'var(--text-tertiary)', textDecoration: 'none',
          padding: '2px 6px', borderRadius: 4, background: 'var(--bg-hover)',
        }}>
          전체화면 →
        </Link>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        style={{
          height: 210,
          overflowY: 'auto',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-xs)',
          scrollbarWidth: 'thin',
        }}
      >
        {msgs.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 10px',
            color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 6 }}>💬</div>
            아직 대화가 없어요<br />첫 메시지를 남겨보세요
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} style={{
            display: 'flex', gap: 6, alignItems: 'flex-start',
            padding: '3px 4px', borderRadius: 'var(--radius-xs)',
          }}>
            {/* 아바타 이니셜 */}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: m.is_mine
                ? 'linear-gradient(135deg, #2563EB, #3B82F6)'
                : 'linear-gradient(135deg, #334155, #475569)',
              color: '#fff', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              {(m.is_mine ? '나' : m.nickname)[0]}
            </div>
            {/* 내용 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-xs)', marginBottom: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: m.is_mine ? 'var(--brand)' : 'var(--text-secondary)',
                }}>
                  {m.is_mine ? '나' : m.nickname}
                </span>
                <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{timeAgo(m.created_at)}</span>
              </div>
              <div style={{
                fontSize: 11, lineHeight: 1.4, color: 'var(--text-primary)',
                wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 입력 영역 */}
      {userId ? (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '6px 8px',
          display: 'flex',
          gap: 5,
          alignItems: 'center',
          background: 'var(--bg-hover)',
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
            placeholder="메시지를 입력하세요"
            maxLength={200}
            style={{
              flex: 1, border: '1px solid var(--border)', outline: 'none',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)', padding: '6px 10px',
              fontSize: 11, color: 'var(--text-primary)',
              minWidth: 0,
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: 'none',
              background: input.trim() ? 'var(--brand)' : 'var(--bg-surface)',
              color: input.trim() ? '#fff' : 'var(--text-tertiary)',
              fontSize: 13, fontWeight: 700, cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            ↑
          </button>
        </div>
      ) : (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 12px', textAlign: 'center',
          background: 'var(--bg-hover)',
        }}>
          <Link href="/login?redirect=/discuss" style={{
            fontSize: 10, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600,
          }}>
            로그인하고 대화 참여 →
          </Link>
        </div>
      )}
    </div>
  );
}
