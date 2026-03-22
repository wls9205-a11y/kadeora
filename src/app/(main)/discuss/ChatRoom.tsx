'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { ReportModal } from '@/components/modals/ReportModal';
import EmptyState from '@/components/shared/EmptyState';
import type { User } from '@supabase/supabase-js';
import { getAvatarColor } from '@/lib/avatar';

interface MsgProfile { id: string; nickname: string | null; grade: number | null; points: number | null; }
interface ChatMsg {
  id: string; user_id: string | null; content: string; created_at: string;
  parent_id?: string | null; profiles?: MsgProfile | null;
  likes?: { count: number }[]; replies?: ChatMsg[];
}

const PAGE_SIZE = 100;
// DB grade_definitions 기준
const GRADE_INFO: Record<number, { title: string; emoji: string; color: string }> = {
  1:{title:'새싹',emoji:'🌱',color:'#34D399'},2:{title:'정보통',emoji:'📡',color:'#60A5FA'},
  3:{title:'동네어른',emoji:'🏘️',color:'#A78BFA'},4:{title:'소문난집',emoji:'🏠',color:'#FBBF24'},
  5:{title:'인플루언서',emoji:'⚡',color:'#F87171'},6:{title:'빅마우스',emoji:'🔥',color:'#FB7185'},
  7:{title:'찐고수',emoji:'💎',color:'#22D3EE'},8:{title:'전설',emoji:'🌟',color:'#FCD34D'},
  9:{title:'신의경지',emoji:'👑',color:'#818CF8'},10:{title:'카더라신',emoji:'🚀',color:'#C084FC'},
};
function avc(uid: string | null) { return getAvatarColor(uid ?? ''); }
function timeAgo(d: string) { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return '방금'; if (m < 60) return m + '분 전'; if (m < 1440) return Math.floor(m / 60) + '시간 전'; return Math.floor(m / 1440) + '일 전'; }
function renderContent(text: string) { return text.split(/(@\S+)/g).map((p, i) => p.startsWith('@') ? <span key={i} style={{ color: 'var(--brand)', fontWeight: 700 }}>{p}</span> : p); }

export default function ChatRoom({ user, myNickname, room = 'lounge' }: { user: User | null; myNickname?: string | null; room?: string }) {
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
  const [replyTarget, setReplyTarget] = useState<{ id: string; nickname: string } | null>(null);
  const [mentionList, setMentionList] = useState<{ id: string; nickname: string; grade: number }[]>([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionTimer = useRef<ReturnType<typeof setTimeout>>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);
  const { error } = useToast();

  const loadMessages = useCallback(async (before?: string) => {
    const sb = createSupabaseBrowser();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let q = sb.from('chat_messages')
      .select('*, profiles:user_id(id, nickname, grade, points), likes:chat_message_likes(count)')
      .eq('room', room)
      .is('parent_id', null)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }).limit(PAGE_SIZE);
    if (before) q = q.lt('created_at', before);
    const { data: mainMsgs } = await q;
    const sorted = (mainMsgs ?? []).reverse() as ChatMsg[];

    if (sorted.length > 0) {
      const ids = sorted.map(m => m.id);
      const { data: replies } = await sb.from('chat_messages')
        .select('*, profiles:user_id(id, nickname, grade, points)')
        .in('parent_id', ids).order('created_at', { ascending: true });
      const replyMap: Record<string, ChatMsg[]> = {};
      (replies ?? []).forEach((r: any) => {
        if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
        replyMap[r.parent_id].push(r as ChatMsg);
      });
      sorted.forEach(m => { m.replies = replyMap[m.id] ?? []; });
    }

    if (before) setMsgs(prev => [...sorted, ...prev]); else setMsgs(sorted);
    setHasMore(sorted.length === PAGE_SIZE);
    return sorted;
  }, []);

  useEffect(() => { if (!user) return; createSupabaseBrowser().from('chat_message_likes').select('message_id').eq('user_id', user.id).then(({ data }) => { if (data) setLikedIds(new Set(data.map((d: any) => d.message_id))); }); }, [user]);

  useEffect(() => {
    setLoading(true);
    loadMessages().then(() => { setLoading(false); isFirst.current = true; });
    const sb = createSupabaseBrowser();
    const ch = sb.channel(`chat_${room}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => { loadMessages(); }).subscribe();
    return () => { sb.removeChannel(ch); if (mentionTimer.current) clearTimeout(mentionTimer.current); };
  }, [loadMessages, room]);

  useEffect(() => { if (isFirst.current) { isFirst.current = false; return; } const el = scrollRef.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 150) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const handleScroll = () => { const el = scrollRef.current; if (el && el.scrollTop < 50 && hasMore && !loadingMore) { setLoadingMore(true); const oldest = msgs[0]; const prev = el.scrollHeight; loadMessages(oldest.created_at).then(() => { requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prev; }); setLoadingMore(false); }); } };

  const send = async () => {
    if (!user) { error('로그인이 필요합니다'); return; }
    const t = input.trim(); if (!t || sending) return;
    setSending(true);
    const sb = createSupabaseBrowser();
    if (replyTarget) {
      await sb.from('chat_messages').insert({ user_id: user.id, content: t, parent_id: replyTarget.id, room });
      setReplyTarget(null);
      await loadMessages();
    } else {
      await sb.from('chat_messages').insert({ user_id: user.id, content: t, room });
    }
    setInput(''); setSending(false); setShowMention(false);

    // 포인트 적립 (1분 디바운싱)
    try {
      const lastKey = `kd_chat_point_${user.id}`;
      const last = parseInt(localStorage.getItem(lastKey) || '0');
      if (Date.now() - last > 60000) {
        await sb.rpc('award_points', { target_user_id: user.id, amount: 1 });
        localStorage.setItem(lastKey, String(Date.now()));
        success('+1P 획득!');
      }
    } catch {}
  };

  const toggleLike = async (mid: string) => { if (!user) return; const sb = createSupabaseBrowser(); const isLiked = likedIds.has(mid); if (isLiked) { await sb.from('chat_message_likes').delete().eq('message_id', mid).eq('user_id', user.id); setLikedIds(p => { const n = new Set(p); n.delete(mid); return n; }); } else { await sb.from('chat_message_likes').insert({ message_id: mid, user_id: user.id }); setLikedIds(p => new Set([...p, mid])); } setMsgs(p => p.map(m => m.id !== mid ? m : { ...m, likes: [{ count: Math.max(0, (m.likes?.[0]?.count ?? 0) + (isLiked ? -1 : 1)) }] })); };

  const openSheet = async (p: MsgProfile | null) => { if (!p) return; setSheetUser(p); if (user && user.id !== p.id) { const { data } = await createSupabaseBrowser().from('follows').select('id').eq('follower_id', user.id).eq('followee_id', p.id).maybeSingle(); setIsFollowing(!!data); } };
  const toggleFollow = async () => { if (!user || !sheetUser) return; const sb = createSupabaseBrowser(); if (isFollowing) { await sb.from('follows').delete().eq('follower_id', user.id).eq('followee_id', sheetUser.id); setIsFollowing(false); } else { await sb.from('follows').insert({ follower_id: user.id, followee_id: sheetUser.id }); setIsFollowing(true); } };

  const handleInput = (val: string) => { setInput(val); const match = val.match(/@([^\s@]*)$/); if (match) { setMentionIndex(0); if (mentionTimer.current) clearTimeout(mentionTimer.current); mentionTimer.current = setTimeout(async () => { if (!match[1]) { setShowMention(false); return; } const { data } = await createSupabaseBrowser().from('profiles').select('id,nickname,grade').ilike('nickname', `${match[1]}%`).limit(6); setMentionList((data ?? []) as any); setShowMention((data ?? []).length > 0); }, 200); } else { setShowMention(false); } };
  const selectMention = (n: string) => { setInput(p => p.replace(/@([^\s@]*)$/, `@${n} `)); setShowMention(false); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (showMention && mentionList.length > 0) { if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionList.length - 1)); return; } if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; } if (e.key === 'Enter') { e.preventDefault(); selectMention(mentionList[mentionIndex].nickname); return; } if (e.key === 'Escape') { setShowMention(false); return; } } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* 라운지 공지 */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
        <span>💬 오늘의 라운지 ({new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}) — 채팅 1회 = 1P</span>
      </div>
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', minHeight: 0, WebkitOverflowScrolling: 'touch' as any }}>
        {loadingMore && <div style={{ textAlign: 'center', padding: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>이전 메시지...</div>}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 0' }}>채팅 불러오는 중...</div>
        ) : msgs.length === 0 ? (
          <EmptyState icon="☕" title="조용한 라운지네요" description="첫 번째 소문의 주인공이 되어보세요" />
        ) : msgs.map(msg => {
          const p = msg.profiles as MsgProfile | null;
          const g = GRADE_INFO[p?.grade ?? 1] ?? GRADE_INFO[1];
          const nick = p?.nickname ?? '사용자';
          const liked = likedIds.has(msg.id);
          const lc = msg.likes?.[0]?.count ?? 0;
          return (
            <div key={msg.id} style={{ marginBottom: 1 }}>
              {/* Main message */}
              <div style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div onClick={() => openSheet(p)} style={{ width: 34, height: 34, borderRadius: '50%', background: avc(msg.user_id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 800, flexShrink: 0, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>{nick[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span onClick={() => openSheet(p)} style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>{nick}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', background: `${g.color}20`, color: g.color, border: `1px solid ${g.color}40`, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>{g.emoji} {g.title}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(msg.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', margin: '0 0 5px', lineHeight: 1.5, wordBreak: 'break-word' }}>{renderContent(msg.content)}</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => toggleLike(msg.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: liked ? 'rgba(248,113,113,0.07)' : 'none', border: 'none', cursor: user ? 'pointer' : 'default', color: liked ? '#F87171' : 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 4, fontWeight: liked ? 700 : 400 }}>
                      {liked ? '❤️' : '🤍'} {lc > 0 ? lc : ''}
                    </button>
                    {user && (
                      <button onClick={() => { setReplyTarget({ id: msg.id, nickname: nick }); document.getElementById('chat-input')?.focus(); }} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 4 }}>
                        💬 {msg.replies && msg.replies.length > 0 ? `${msg.replies.length}` : '답글'}
                      </button>
                    )}
                    {user && user.id !== msg.user_id && (
                      <button onClick={() => setReportTarget(msg.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', padding: '2px 4px', marginLeft: 'auto' }}>신고</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Replies */}
              {msg.replies && msg.replies.length > 0 && (
                <div style={{ marginLeft: 56, paddingLeft: 10, borderLeft: '2px solid var(--border)', marginBottom: 4 }}>
                  {msg.replies.map(reply => {
                    const rp = reply.profiles as MsgProfile | null;
                    const rg = GRADE_INFO[rp?.grade ?? 1] ?? GRADE_INFO[1];
                    const rNick = rp?.nickname ?? '사용자';
                    return (
                      <div key={reply.id} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 6, transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div onClick={() => openSheet(rp)} style={{ width: 24, height: 24, borderRadius: '50%', background: avc(reply.user_id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 800, flexShrink: 0, cursor: 'pointer' }}>{rNick[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                            <span onClick={() => openSheet(rp)} style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>{rNick}</span>
                            <span style={{ fontSize: 'var(--fs-xs)', background: `${rg.color}18`, color: rg.color, padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>{rg.emoji}</span>
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(reply.created_at)}</span>
                          </div>
                          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>{renderContent(reply.content)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: '0 0 16px 16px' }}>
        {replyTarget && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', background: 'rgba(255,69,0,0.06)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>💬 @{replyTarget.nickname} 에게 답글</span>
            <button onClick={() => { setReplyTarget(null); setInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)', padding: 0, lineHeight: 1 }}>×</button>
          </div>
        )}
        {user ? (
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: avc(user.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>{(myNickname ?? '나')[0]}</div>
              <div style={{ flex: 1, position: 'relative' }}>
                {showMention && mentionList.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.12)' }}>
                    {mentionList.map((u, i) => (
                      <div key={u.id} onClick={() => selectMention(u.nickname ?? '')} style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', background: i === mentionIndex ? 'var(--bg-hover)' : 'transparent' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: avc(u.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{(u.nickname ?? '?')[0]}</div>
                        <span style={{ fontWeight: 600 }}>@{u.nickname}</span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: (GRADE_INFO[u.grade ?? 1] ?? GRADE_INFO[1]).color, marginLeft: 'auto' }}>{(GRADE_INFO[u.grade ?? 1] ?? GRADE_INFO[1]).emoji}</span>
                      </div>
                    ))}
                  </div>
                )}
                <textarea id="chat-input" value={input} onChange={e => handleInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={replyTarget ? `@${replyTarget.nickname}에게 답글...` : '소문 남기기... (@멘션, Enter 전송)'}
                  maxLength={300} rows={1}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', padding: '8px 58px 8px 12px', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, minHeight: 38 }} />
                <button onClick={send} disabled={!input.trim() || sending} style={{ position: 'absolute', right: 6, bottom: 6, padding: '3px 10px', borderRadius: 6, border: 'none', background: input.trim() ? (replyTarget ? '#A78BFA' : 'var(--brand)') : 'transparent', color: input.trim() ? 'white' : 'var(--text-tertiary)', fontWeight: 700, fontSize: 'var(--fs-xs)', cursor: input.trim() ? 'pointer' : 'default' }}>{replyTarget ? '↩' : '↑'}</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
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
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: avc(sheetUser.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xl)', fontWeight: 700 }}>{(sheetUser.nickname ?? '?')[0]}</div>
              <div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{sheetUser.nickname ?? '사용자'}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: (GRADE_INFO[sheetUser.grade ?? 1] ?? GRADE_INFO[1]).color, fontWeight: 600 }}>
                  {(GRADE_INFO[sheetUser.grade ?? 1] ?? GRADE_INFO[1]).emoji} {(GRADE_INFO[sheetUser.grade ?? 1] ?? GRADE_INFO[1]).title}
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 8 }}>{(sheetUser.points ?? 0).toLocaleString()}pts</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/profile/${sheetUser.id}`} onClick={() => setSheetUser(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'block' }}>프로필 보기</a>
              {user && user.id !== sheetUser.id && (
                <button onClick={toggleFollow} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: isFollowing ? 'var(--bg-hover)' : 'var(--brand)', color: isFollowing ? 'var(--text-secondary)' : 'white', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer' }}>{isFollowing ? '팔로잉 ✓' : '팔로우'}</button>
              )}
            </div>
          </div>
        </div>
      )}
      {reportTarget && <ReportModal targetType="chat" targetId={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  );
}
