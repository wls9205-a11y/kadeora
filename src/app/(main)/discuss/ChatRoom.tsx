'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { ReportModal } from '@/components/modals/ReportModal';
import type { User } from '@supabase/supabase-js';

interface MsgProfile { id: string; nickname: string | null; grade: number | null; points: number | null; }
interface ChatMsg {
  id: string; user_id: string | null; content: string; created_at: string;
  profiles?: MsgProfile | null;
  likes?: { count: number }[];
}

const PAGE_SIZE = 100;
const GRADE_INFO: Record<number, { title: string; emoji: string; color: string }> = {
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

const AVATAR_COLORS = ['#FF5B36','#FF8C42','#4CAF50','#2196F3','#9C27B0','#E91E63','#FF9800','#00BCD4'];
function avatarColor(userId: string | null): string {
  if (!userId) return AVATAR_COLORS[0];
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}

export default function ChatRoom({ user, myNickname }: { user: User | null; myNickname?: string | null }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [sheetUser, setSheetUser] = useState<MsgProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const { error } = useToast();

  const loadMessages = useCallback(async (before?: string) => {
    const sb = createSupabaseBrowser();
    let q = sb.from('chat_messages')
      .select('*, profiles:user_id(id, nickname, grade, points), likes:chat_message_likes(count)')
      .order('created_at', { ascending: false }).limit(PAGE_SIZE);
    if (before) q = q.lt('created_at', before);
    const { data } = await q;
    const sorted = (data ?? []).reverse() as ChatMsg[];
    if (before) setMsgs(prev => [...sorted, ...prev]);
    else setMsgs(sorted);
    setHasMore(sorted.length === PAGE_SIZE);
    return sorted;
  }, []);

  useEffect(() => {
    if (!user) return;
    createSupabaseBrowser().from('chat_message_likes').select('message_id').eq('user_id', user.id)
      .then(({ data }) => { if (data) setLikedIds(new Set(data.map((d: any) => d.message_id))); });
  }, [user]);

  useEffect(() => {
    setLoading(true);
    loadMessages().then(() => { setLoading(false); isFirstLoad.current = true; });
    const sb = createSupabaseBrowser();
    const ch = sb.channel('chat_lounge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const nm = payload.new as ChatMsg;
        const { data: prof } = await sb.from('profiles').select('id, nickname, grade, points').eq('id', nm.user_id!).single();
        setMsgs(prev => [...prev, { ...nm, profiles: prof, likes: [{ count: 0 }] }]);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [loadMessages]);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 150)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    await createSupabaseBrowser().from('chat_messages').insert({ user_id: user.id, content: t });
    setInput(''); setSending(false);
  };

  const toggleLike = async (messageId: string) => {
    if (!user) return;
    const sb = createSupabaseBrowser();
    const isLiked = likedIds.has(messageId);
    if (isLiked) {
      await sb.from('chat_message_likes').delete().eq('message_id', messageId).eq('user_id', user.id);
      setLikedIds(prev => { const n = new Set(prev); n.delete(messageId); return n; });
    } else {
      await sb.from('chat_message_likes').insert({ message_id: messageId, user_id: user.id });
      setLikedIds(prev => new Set([...prev, messageId]));
    }
    setMsgs(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      return { ...m, likes: [{ count: Math.max(0, (m.likes?.[0]?.count ?? 0) + (isLiked ? -1 : 1)) }] };
    }));
  };

  const openSheet = async (p: MsgProfile | null) => {
    if (!p) return;
    setSheetUser(p);
    if (user && user.id !== p.id) {
      const { data } = await createSupabaseBrowser().from('follows').select('id').eq('follower_id', user.id).eq('followee_id', p.id).maybeSingle();
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
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', minHeight: 400, maxHeight: 800 }}>
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loadingMore && <div style={{ textAlign: 'center', padding: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>이전 메시지 불러오는 중...</div>}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 0' }}>채팅 불러오는 중...</div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>☕</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>아직 조용하네요</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>첫 번째 소문의 주인공이 되어보세요!</p>
          </div>
        ) : msgs.map(msg => {
          const p = msg.profiles as MsgProfile | null;
          const g = GRADE_INFO[p?.grade ?? 1] ?? GRADE_INFO[1];
          const nick = p?.nickname ?? '사용자';
          const liked = likedIds.has(msg.id);
          const lc = msg.likes?.[0]?.count ?? 0;
          return (
            <div key={msg.id} style={{
              background: 'var(--bg-base)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div onClick={() => openSheet(p)} style={{
                  width: 40, height: 40, borderRadius: '50%', background: avatarColor(msg.user_id),
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, flexShrink: 0, cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}>{nick[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span onClick={() => openSheet(p)} style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>{nick}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700,
                      background: `${g.color}22`, color: g.color, border: `1px solid ${g.color}44`,
                    }}>{g.emoji} {g.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(msg.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 15, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.6, wordBreak: 'break-word' }}>{msg.content}</p>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <button onClick={() => toggleLike(msg.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: liked ? '#ff444418' : 'var(--bg-hover)',
                      border: `1px solid ${liked ? '#ff444444' : 'var(--border)'}`,
                      borderRadius: 20, padding: '4px 12px', cursor: user ? 'pointer' : 'default',
                      color: liked ? '#ff4444' : 'var(--text-tertiary)', fontSize: 12, fontWeight: liked ? 700 : 400,
                    }}>
                      {liked ? '❤️' : '🤍'} {lc > 0 ? lc : '좋아요'}
                    </button>
                    {user && user.id !== msg.user_id && (
                      <button onClick={() => setReportTarget(msg.id)} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>신고</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 16px', borderTop: '2px solid var(--border)', background: 'var(--bg-surface)', borderRadius: '0 0 16px 16px' }}>
        {user ? (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: avatarColor(user.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                {(myNickname ?? '나')[0]}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="라운지에 소문 남기기... (Enter 전송)" maxLength={300} rows={1}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', padding: '10px 70px 10px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, minHeight: 42 }} />
                <button onClick={send} disabled={!input.trim() || sending} style={{
                  position: 'absolute', right: 8, bottom: 8, padding: '5px 14px', borderRadius: 8, border: 'none',
                  background: input.trim() ? 'var(--brand)' : 'var(--bg-hover)', color: input.trim() ? 'white' : 'var(--text-tertiary)',
                  fontWeight: 700, fontSize: 12, cursor: input.trim() ? 'pointer' : 'default',
                }}>전송</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>{input.length}/300</div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            <a href="/login" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>로그인</a>하고 라운지에 참여하세요 🎉
          </div>
        )}
      </div>

      {/* Mini Profile Sheet */}
      {sheetUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setSheetUser(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: 24, zIndex: 1, maxWidth: 480, width: '100%', margin: '0 auto' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarColor(sheetUser.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
                {(sheetUser.nickname ?? '?')[0]}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{sheetUser.nickname ?? '사용자'}</div>
                <div style={{ fontSize: 13, color: (GRADE_INFO[sheetUser.grade ?? 1] ?? GRADE_INFO[1]).color, fontWeight: 600 }}>
                  {(GRADE_INFO[sheetUser.grade ?? 1] ?? GRADE_INFO[1]).emoji} {(GRADE_INFO[sheetUser.grade ?? 1] ?? GRADE_INFO[1]).title}
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 8 }}>{(sheetUser.points ?? 0).toLocaleString()}pts</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/profile/${sheetUser.id}`} onClick={() => setSheetUser(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                프로필 보기
              </a>
              {user && user.id !== sheetUser.id && (
                <button onClick={toggleFollow} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: isFollowing ? 'var(--bg-hover)' : 'var(--brand)', color: isFollowing ? 'var(--text-secondary)' : 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {isFollowing ? '팔로잉 ✓' : '팔로우'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {reportTarget && <ReportModal targetType="chat" targetId={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  );
}
