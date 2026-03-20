'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { ReportModal } from '@/components/modals/ReportModal';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

interface ChatProfile { id: string; nickname: string | null; avatar_url: string | null; grade: number | null; points: number | null; posts_count?: number | null; }
interface ChatMessage {
  id: string; user_id: string | null; content: string; created_at: string;
  profiles?: ChatProfile | null;
  like_count?: number;
}

const PAGE_SIZE = 100;
const GRADES: Record<number, { title: string; emoji: string; color: string }> = {
  1: { title: '새싹', emoji: '🌱', color: '#4CAF50' },
  2: { title: '정보통', emoji: '📡', color: '#2196F3' },
  3: { title: '동네어른', emoji: '🏘️', color: '#9C27B0' },
  4: { title: '소문난집', emoji: '🏠', color: '#FF9800' },
  5: { title: '인플루언서', emoji: '⚡', color: '#F44336' },
  6: { title: '빅마우스', emoji: '🦁', color: '#E91E63' },
  7: { title: '청약고수', emoji: '🏆', color: '#FFD700' },
  8: { title: '전설', emoji: '👑', color: '#FF6B35' },
  9: { title: '신의경지', emoji: '🌟', color: '#9C27B0' },
  10: { title: '카더라신', emoji: '⚡', color: '#FF4500' },
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}

export default function ChatRoom({ user }: { user: User | null }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [sheetUser, setSheetUser] = useState<ChatProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const { error } = useToast();

  const loadMessages = useCallback(async (before?: string) => {
    const sb = createSupabaseBrowser();
    let query = sb.from('chat_messages')
      .select('*, profiles:user_id(id, nickname, avatar_url, grade, points)')
      .order('created_at', { ascending: false }).limit(PAGE_SIZE);
    if (before) query = query.lt('created_at', before);
    const { data } = await query;
    const sorted = (data ?? []).reverse() as ChatMessage[];
    if (before) { setMsgs(prev => [...sorted, ...prev]); } else { setMsgs(sorted); }
    setHasMore(sorted.length === PAGE_SIZE);

    // Load like counts for these messages
    const ids = sorted.map(m => m.id);
    if (ids.length > 0) {
      const { data: lc } = await sb.from('chat_message_likes').select('message_id').in('message_id', ids);
      const counts: Record<string, number> = {};
      (lc ?? []).forEach((l: any) => { counts[l.message_id] = (counts[l.message_id] || 0) + 1; });
      setLikeCounts(prev => ({ ...prev, ...counts }));
    }
    return sorted;
  }, []);

  // Load my likes
  useEffect(() => {
    if (!user) return;
    const sb = createSupabaseBrowser();
    sb.from('chat_message_likes').select('message_id').eq('user_id', user.id)
      .then(({ data }) => { if (data) setLikedIds(new Set(data.map((d: any) => d.message_id))); });
  }, [user]);

  // Initial load + realtime
  useEffect(() => {
    setLoading(true);
    loadMessages().then(() => { setLoading(false); isFirstLoad.current = true; });
    const sb = createSupabaseBrowser();
    const ch = sb.channel('chat_lounge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const nm = payload.new as ChatMessage;
        const { data: prof } = await sb.from('profiles').select('id, nickname, avatar_url, grade, points').eq('id', nm.user_id!).single();
        setMsgs(prev => [...prev, { ...nm, profiles: prof }]);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [loadMessages]);

  // Auto-scroll only on new messages
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop < 50 && hasMore && !loadingMore) {
      setLoadingMore(true);
      const oldest = msgs[0];
      const prev = el.scrollHeight;
      loadMessages(oldest.created_at).then(() => {
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prev; });
        setLoadingMore(false);
      });
    }
  };

  const send = async () => {
    if (!user) { error('로그인이 필요합니다'); return; }
    const t = input.trim();
    if (!t || sending) return;
    if (t.length > 300) { error('300자까지 입력 가능합니다'); return; }
    setSending(true);
    const sb = createSupabaseBrowser();
    await sb.from('chat_messages').insert({ user_id: user.id, content: t });
    setInput(''); setSending(false);
  };

  const toggleLike = async (msgId: string) => {
    if (!user) { error('로그인이 필요합니다'); return; }
    const sb = createSupabaseBrowser();
    const liked = likedIds.has(msgId);
    if (liked) {
      await sb.from('chat_message_likes').delete().eq('message_id', msgId).eq('user_id', user.id);
      setLikedIds(prev => { const n = new Set(prev); n.delete(msgId); return n; });
      setLikeCounts(prev => ({ ...prev, [msgId]: Math.max(0, (prev[msgId] || 1) - 1) }));
    } else {
      await sb.from('chat_message_likes').insert({ message_id: msgId, user_id: user.id });
      setLikedIds(prev => new Set(prev).add(msgId));
      setLikeCounts(prev => ({ ...prev, [msgId]: (prev[msgId] || 0) + 1 }));
    }
  };

  const openUserSheet = async (profile: ChatProfile | null) => {
    if (!profile) return;
    setSheetUser(profile);
    if (user && user.id !== profile.id) {
      const sb = createSupabaseBrowser();
      const { data } = await sb.from('follows').select('id').eq('follower_id', user.id).eq('followee_id', profile.id).maybeSingle();
      setIsFollowing(!!data);
    }
  };

  const toggleFollow = async () => {
    if (!user || !sheetUser) return;
    const sb = createSupabaseBrowser();
    if (isFollowing) {
      await sb.from('follows').delete().eq('follower_id', user.id).eq('followee_id', sheetUser.id);
      setIsFollowing(false);
    } else {
      await sb.from('follows').insert({ follower_id: user.id, followee_id: sheetUser.id });
      setIsFollowing(true);
    }
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 400, maxHeight: 700 }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>실시간 채팅</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{msgs.length > 0 ? `${msgs.length}개 메시지` : ''}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {loadingMore && <div style={{ textAlign: 'center', padding: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>이전 메시지 불러오는 중...</div>}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 0' }}>채팅 불러오는 중...</div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '60px 0', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>첫 메시지를 남겨보세요!
          </div>
        ) : (
          msgs.map(msg => {
            const p = msg.profiles as ChatProfile | null;
            const g = GRADES[p?.grade ?? 1] ?? GRADES[1];
            const liked = likedIds.has(msg.id);
            const lc = likeCounts[msg.id] || 0;
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => openUserSheet(p)}>
                  {(p?.nickname ?? '?')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + grade + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span onClick={() => openUserSheet(p)} style={{ fontWeight: 700, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                      {p?.nickname ?? '사용자'}
                    </span>
                    <span style={{ fontSize: 11, color: g.color }}>{g.emoji} {g.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(msg.created_at)}</span>
                  </div>
                  {/* Content */}
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <button onClick={() => toggleLike(msg.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: user ? 'pointer' : 'default', color: liked ? 'var(--error)' : 'var(--text-tertiary)', fontSize: 12, padding: 0 }}>
                      {liked ? '❤️' : '🤍'} {lc > 0 ? lc : ''}
                    </button>
                    {user && user.id !== msg.user_id && (
                      <button onClick={() => setReportTarget(msg.id)} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>신고</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        {user ? (
          <>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="메시지를 입력하세요 (300자)" maxLength={300}
              style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }} />
            <button onClick={send} disabled={!input.trim() || sending}
              style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: !input.trim() || sending ? 0.5 : 1 }}>전송</button>
          </>
        ) : (
          <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '10px 0' }}>
            <a href="/login" style={{ color: 'var(--brand)', textDecoration: 'none' }}>로그인</a>하면 채팅에 참여할 수 있습니다
          </div>
        )}
      </div>

      {/* Mini Profile Sheet */}
      {sheetUser && (
        <>
          <div onClick={() => setSheetUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000, background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0', padding: '24px 20px', maxHeight: '50vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
                {(sheetUser.nickname ?? '?')[0]}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{sheetUser.nickname ?? '사용자'}</div>
                <div style={{ fontSize: 13, color: (GRADES[sheetUser.grade ?? 1] ?? GRADES[1]).color, marginTop: 2 }}>
                  {(GRADES[sheetUser.grade ?? 1] ?? GRADES[1]).emoji} {(GRADES[sheetUser.grade ?? 1] ?? GRADES[1]).title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{(sheetUser.points ?? 0).toLocaleString()}P</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/profile/${sheetUser.id}`} onClick={() => setSheetUser(null)}
                style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                프로필 보기
              </Link>
              {user && user.id !== sheetUser.id && (
                <button onClick={toggleFollow}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    background: isFollowing ? 'var(--bg-hover)' : 'var(--brand)', color: isFollowing ? 'var(--text-secondary)' : 'var(--text-inverse)' }}>
                  {isFollowing ? '팔로잉' : '팔로우'}
                </button>
              )}
            </div>
            <button onClick={() => setSheetUser(null)}
              style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer' }}>닫기</button>
          </div>
        </>
      )}

      {reportTarget && <ReportModal targetType="chat" targetId={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  );
}
