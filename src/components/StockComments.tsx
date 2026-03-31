'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAvatarColor } from '@/lib/avatar';
import { timeAgo } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';

interface StockComment {
  id: string; author_id: string; content: string; created_at: string;
  likes_count: number; replies_count: number; parent_id: string | null;
  profiles?: { nickname: string | null; grade: number | null } | null;
}

const avc = getAvatarColor;

const GL = (g?: number) => { if(!g||g<2) return '새싹'; if(g<4) return '정보통'; if(g<6) return '동네어른'; if(g<8) return '소문난집'; return '인플루언서'; };

const REACTIONS = ['📉','📈','❤️','👍','🙏','😊','😮'];

export default function StockComments({ symbol, stockName }: { symbol: string; stockName: string }) {
  const pathname = usePathname();
  const [comments, setComments] = useState<StockComment[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const { userId } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [userReactions, setUserReactions] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, StockComment[]>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { success } = useToast();

  const loadComments = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const order = sort === 'latest'
      ? { column: 'created_at', ascending: false }
      : { column: 'likes_count', ascending: false };
    const { data } = await sb.from('stock_comments')
      .select('id, author_id, content, created_at, likes_count, replies_count, parent_id, profiles:author_id(nickname, grade)')
      .eq('symbol', symbol)
      .is('parent_id', null)
      .order(order.column, { ascending: order.ascending })
      .limit(30);
    if (data) setComments(data as StockComment[]);
  }, [symbol, sort]);

  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    (async () => {
      const { data: likes } = await sb.from('stock_comment_likes')
        .select('comment_id')
        .eq('author_id', userId);
      if (likes) setLikedIds(new Set(likes.map((l) => l.comment_id!)));
      const { data: reacts } = await sb.from('stock_comment_reactions')
        .select('comment_id, emoji')
        .eq('author_id', userId);
      if (reacts) {
        const m: Record<string, string> = {};
        reacts.forEach((r) => { if (r.comment_id) m[r.comment_id] = r.emoji; });
        setUserReactions(m);
      }
      const { data: follows } = await sb.from('follows').select('followee_id').eq('follower_id', userId);
      setFollowingIds(new Set(follows?.map((f) => f.followee_id) || []));
    })();
    loadComments();
  }, [loadComments, userId]);

  const handleSend = async () => {
    if (!input.trim() || !userId || sending) return;
    setSending(true);
    const sb = createSupabaseBrowser();
    const { data, error } = await sb.from('stock_comments')
      .insert({ symbol, author_id: userId, content: input.trim() })
      .select('id, author_id, content, created_at, likes_count, replies_count, parent_id, profiles:author_id(nickname, grade)')
      .single();
    if (!error && data) {
      setComments(prev => [data as StockComment, ...prev]);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
    setSending(false);
  };

  const toggleLike = async (commentId: string) => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    const liked = likedIds.has(commentId);
    // optimistic
    setLikedIds(prev => {
      const next = new Set(prev);
      if (liked) next.delete(commentId); else next.add(commentId);
      return next;
    });
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, likes_count: c.likes_count + (liked ? -1 : 1) } : c
    ));
    if (liked) {
      await sb.from('stock_comment_likes').delete().eq('comment_id', commentId).eq('author_id', userId);
    } else {
      await sb.from('stock_comment_likes').insert({ comment_id: commentId, author_id: userId });
    }
  };

  const sendReaction = async (commentId: string, emoji: string) => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    const existing = userReactions[commentId];
    if (existing === emoji) {
      await sb.from('stock_comment_reactions').delete().eq('comment_id', commentId).eq('author_id', userId);
      setUserReactions(prev => { const n = { ...prev }; delete n[commentId]; return n; });
    } else {
      if (existing) {
        await sb.from('stock_comment_reactions').update({ emoji }).eq('comment_id', commentId).eq('author_id', userId);
      } else {
        await sb.from('stock_comment_reactions').insert({ comment_id: commentId, author_id: userId, emoji });
      }
      setUserReactions(prev => ({ ...prev, [commentId]: emoji }));
    }
  };

  const loadReplies = async (commentId: string) => {
    const sb = createSupabaseBrowser();
    const { data } = await sb.from('stock_comments')
      .select('id, author_id, content, created_at, likes_count, replies_count, parent_id, profiles:author_id(nickname, grade)')
      .eq('parent_id', commentId)
      .order('created_at', { ascending: true })
      .limit(30);
    if (data) setReplies(prev => ({ ...prev, [commentId]: data as StockComment[] }));
  };

  const sendReply = async (parentId: string) => {
    const text = (replyInputs[parentId] || '').trim();
    if (!text || !userId) return;
    const sb = createSupabaseBrowser();
    const { data, error } = await sb.from('stock_comments')
      .insert({ symbol, author_id: userId, content: text, parent_id: parentId })
      .select('id, author_id, content, created_at, likes_count, replies_count, parent_id, profiles:author_id(nickname, grade)')
      .single();
    if (!error && data) {
      setReplies(prev => ({ ...prev, [parentId]: [...(prev[parentId] || []), data as StockComment] }));
      setReplyInputs(prev => ({ ...prev, [parentId]: '' }));
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies_count: c.replies_count + 1 } : c
      ));
    }
  };

  const deleteComment = async (id: string, parentId: string | null) => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    await sb.from('stock_comments').delete().eq('id', id).eq('author_id', userId);
    if (parentId) {
      setReplies(prev => ({ ...prev, [parentId]: (prev[parentId] || []).filter(c => c.id !== id) }));
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies_count: Math.max(0, c.replies_count - 1) } : c
      ));
    } else {
      setComments(prev => prev.filter(c => c.id !== id));
    }
    setMenuId(null);
  };

  const toggleFollow = async (targetId: string) => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    if (followingIds.has(targetId)) {
      await sb.from('follows').delete().eq('follower_id', userId).eq('followee_id', targetId);
      setFollowingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    } else {
      await sb.from('follows').insert({ follower_id: userId, followee_id: targetId });
      setFollowingIds(prev => new Set([...prev, targetId]));
    }
  };

  const handleBookmark = async (content: string) => {
    await navigator.clipboard.writeText(content);
    success('클립보드에 복사되었습니다');
  };

  const reportComment = async (id: string) => {
    success('신고가 접수되었습니다');
    setMenuId(null);
  };

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadReplies(id);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, 200);
    setInput(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const renderAvatar = (nick: string, size = 36) => (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avc(nick), display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: 'var(--text-inverse)',
    }}>{nick[0]}</div>
  );

  const renderComment = (c: StockComment, isReply = false) => {
    const nick = c.profiles?.nickname ?? '사용자';
    const grade = c.profiles?.grade ?? undefined;
    const liked = likedIds.has(c.id);
    const isOwn = userId === c.author_id;
    const isExpanded = expandedId === c.id;
    const showMenu = menuId === c.id;

    return (
      <div key={c.id} style={{ padding: isReply ? '8px 0' : '12px 0', borderBottom: isReply ? 'none' : '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {renderAvatar(nick, isReply ? 28 : 36)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>{nick}</span>
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
              }}>{GL(grade)}</span>
              {userId && userId !== c.author_id && (
                <button onClick={() => toggleFollow(c.author_id)} style={{
                  padding: '4px 12px', borderRadius: 4,
                  border: `1px solid var(--brand)`,
                  background: followingIds.has(c.author_id) ? 'var(--brand)' : 'transparent',
                  color: followingIds.has(c.author_id) ? 'white' : 'var(--brand)',
                  fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {followingIds.has(c.author_id) ? '팔로잉' : '팔로우'}
                </button>
              )}
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(c.created_at)}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6, wordBreak: 'break-word' }}>
              {c.content}
            </div>
            {/* action bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
              <button
                onClick={() => toggleLike(c.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 'var(--fs-sm)', color: liked ? 'var(--accent-red)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                {liked ? '❤️' : '🤍'} {c.likes_count > 0 ? c.likes_count : ''}
              </button>
              {!isReply && (
                <button
                  onClick={() => handleExpand(c.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  💬 {c.replies_count > 0 ? c.replies_count : ''}
                </button>
              )}
              <button
                onClick={() => { if (navigator.share) navigator.share({ text: c.content }); else navigator.clipboard.writeText(c.content); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}
              >
                공유
              </button>
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <button
                  onClick={() => setMenuId(showMenu ? null : c.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)' }}
                >⋯</button>
                {showMenu && (
                  <div style={{
                    position: 'absolute', right: 0, top: 20, background: 'var(--bg-surface)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 10, overflow: 'hidden', minWidth: 80,
                  }}>
                    <button
                      onClick={() => { handleBookmark(c.content); setMenuId(null); }}
                      style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >북마크</button>
                    {isOwn ? (
                      <button
                        onClick={() => deleteComment(c.id, c.parent_id)}
                        style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >삭제</button>
                    ) : (
                      <button
                        onClick={() => reportComment(c.id)}
                        style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >신고</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* expanded section for non-reply */}
            {!isReply && isExpanded && (
              <div style={{ marginTop: 10 }}>
                {/* emoji reactions */}
                <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap', marginBottom: 10 }}>
                  {REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(c.id, emoji)}
                      style={{
                        padding: '4px 8px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-base)', cursor: 'pointer',
                        border: userReactions[c.id] === emoji ? '2px solid var(--brand)' : '1px solid var(--border)',
                        background: userReactions[c.id] === emoji ? 'var(--bg-hover)' : 'transparent',
                      }}
                    >{emoji}</button>
                  ))}
                </div>
                {/* replies */}
                <div style={{ paddingLeft: 4 }}>
                  {(replies[c.id] || []).map(r => renderComment(r, true))}
                </div>
                {/* reply input */}
                {userId && (
                  <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 6 }}>
                    <input
                      value={replyInputs[c.id] || ''}
                      onChange={e => setReplyInputs(prev => ({ ...prev, [c.id]: e.target.value.slice(0, 200) }))}
                      onKeyDown={e => { if (e.key === 'Enter') sendReply(c.id); }}
                      placeholder="답글 남기기..."
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: 'var(--fs-sm)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', background: 'var(--bg-base)',
                        color: 'var(--text-primary)', boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => sendReply(c.id)}
                      disabled={!(replyInputs[c.id] || '').trim()}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 'var(--fs-sm)',
                        fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                        background: 'var(--brand)', color: 'var(--text-inverse)',
                        opacity: (replyInputs[c.id] || '').trim() ? 1 : 0.5,
                      }}
                    >등록</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
        💬 {stockName} 한줄평
      </div>

      {/* sort tabs */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 14 }}>
        {([['latest', '최신순'], ['popular', '인기순']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            style={{
              padding: '5px 14px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: sort === key ? 'var(--brand)' : 'var(--bg-hover)',
              color: sort === key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}
          >{label}</button>
        ))}
      </div>

      {/* write box */}
      {userId ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--sp-lg)', alignItems: 'flex-start' }}>
          {renderAvatar('나', 36)}
          <div style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="한줄평 남기기..."
              rows={1}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 'var(--fs-sm)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', boxSizing: 'border-box',
                resize: 'none', overflow: 'hidden', lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{input.length}/200</span>
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 'var(--fs-sm)',
                  fontWeight: 700, cursor: 'pointer',
                  background: 'var(--brand)', color: 'var(--text-inverse)',
                  opacity: sending || !input.trim() ? 0.5 : 1,
                }}
              >{sending ? '등록 중...' : '등록'}</button>
            </div>
          </div>
        </div>
      ) : (
        <Link
          href={`/login?redirect=${encodeURIComponent(pathname)}`}
          style={{
            display: 'block', textAlign: 'center', padding: '12px 0', marginBottom: 14,
            borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--brand)', textDecoration: 'none',
          }}
        >
          로그인하고 한줄평 남기기
        </Link>
      )}

      {/* comment list */}
      {comments.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>
          아직 한줄평이 없어요. 첫 번째 한줄평을 남겨보세요!
        </div>
      ) : (
        comments.map(c => renderComment(c))
      )}
    </div>
  );
}
