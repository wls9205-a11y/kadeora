'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import { CATEGORY_MAP, REGIONS } from '@/lib/constants';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
function numFmt(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

interface Props { posts: PostWithProfile[]; trending: TrendingKeyword[]; activeCategory: string; activeRegion?: string; }

export default function FeedClient({ posts, activeCategory, activeRegion = 'all' }: Props) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(40);
  const [showRegionBanner, setShowRegionBanner] = useState(false);
  const [tipSeen, setTipSeen] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<number>>(new Set());
  const [userRegion, setUserRegion] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipSeen(!!localStorage.getItem('kd_tip_seen'));
    }
  }, []);

  // Initialize like counts from posts data
  useEffect(() => {
    const counts: Record<number, number> = {};
    posts.forEach(p => { counts[p.id] = p.likes_count ?? 0; });
    setLikeCounts(counts);
  }, [posts]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const userId = data.session.user.id;
        setCurrentUserId(userId);

        const { data: profile } = await sb.from('profiles')
          .select('region_text').eq('id', userId).single();
        if (profile && !profile.region_text) setShowRegionBanner(true);
        if (profile?.region_text) {
          const matched = REGIONS.find(r => r.value !== 'all' && profile.region_text.startsWith(r.value));
          if (matched) setUserRegion(matched.value);
        }

        // Load user's liked posts
        const { data: likes } = await sb.from('post_likes')
          .select('post_id')
          .eq('user_id', userId);
        if (likes) setLikedPosts(new Set(likes.map(l => l.post_id)));

        // Load user's bookmarks
        const postIds = posts.map(p => p.id);
        if (postIds.length > 0) {
          const res = await fetch(`/api/bookmarks?postIds=${postIds.join(',')}`).catch(() => null);
          if (res?.ok) {
            const d = await res.json().catch(() => null);
            if (d?.bookmarkedIds) setBookmarkedPosts(new Set(d.bookmarkedIds));
          }
        }
      }
    });
  }, [posts]);

  const handleUpvote = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push('/login'); return; }

    const sb = createSupabaseBrowser();
    const alreadyLiked = likedPosts.has(postId);

    // Optimistic update
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(postId); else next.add(postId);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + (alreadyLiked ? -1 : 1),
    }));

    if (alreadyLiked) {
      await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
    } else {
      await sb.from('post_likes').insert({ post_id: postId, user_id: currentUserId });
    }
  };

  const handleComment = (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/feed/${postId}#comments`);
  };

  const handleShare = async (e: React.MouseEvent, post: PostWithProfile) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/feed/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('링크가 복사되었습니다!');
      } catch {}
    }
  };

  const handleBookmark = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push('/login'); return; }

    const alreadyBookmarked = bookmarkedPosts.has(postId);
    // Optimistic update
    setBookmarkedPosts(prev => {
      const next = new Set(prev);
      if (alreadyBookmarked) next.delete(postId); else next.add(postId);
      return next;
    });

    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        // Revert
        setBookmarkedPosts(prev => {
          const next = new Set(prev);
          if (alreadyBookmarked) next.add(postId); else next.delete(postId);
          return next;
        });
      }
    } catch {
      // Revert
      setBookmarkedPosts(prev => {
        const next = new Set(prev);
        if (alreadyBookmarked) next.add(postId); else next.delete(postId);
        return next;
      });
    }
  };

  const observerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibleCount(c => Math.min(c + 40, posts.length)); },
      { threshold: 0.1 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [posts.length]);

  const categories = [
    { key: 'all', label: '전체' }, { key: 'local', label: '🏘 우리동네' },
    { key: 'stock', label: '📈 주식' }, { key: 'apt', label: '🏠 부동산' }, { key: 'free', label: '💬 자유' },
  ];
  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 지역 미설정 배너 */}
      {showRegionBanner && (
        <div style={{
          background:'var(--brand)', color:'var(--text-inverse)',
          padding:'10px 16px', borderRadius:4, marginBottom:10,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          fontSize:13, fontWeight:600,
        }}>
          <span>📍 지역을 설정하면 우리동네 소식을 볼 수 있어요!</span>
          <a href="/onboarding" style={{
            color:'var(--text-inverse)', textDecoration:'underline', fontWeight:700, marginLeft:8,
          }}>설정하기</a>
        </div>
      )}

      {/* 안내 배너 */}
      {!tipSeen && (
        <div style={{
          background:'var(--bg-surface)', border:'1px solid var(--border)',
          borderRadius:8, padding:'10px 14px', marginBottom:8,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          fontSize:13, color:'var(--text-secondary)',
        }}>
          <span style={{ whiteSpace:'nowrap' }}>💡 ▲ 숫자를 클릭하면 좋은 글에 투표할 수 있어요!</span>
          <button onClick={() => { setTipSeen(true); localStorage.setItem('kd_tip_seen','1'); }}
            aria-label="닫기"
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', fontSize:16, flexShrink:0, marginLeft:8 }}>✕</button>
        </div>
      )}

      {/* 카테고리 바 */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 4, padding: '8px 10px', display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'nowrap', overflowX: 'auto',
      }}>
        {categories.map(cat => (
          <button key={cat.key} aria-pressed={activeCategory === cat.key}
            onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
            style={{
              padding: '7px 14px', borderRadius: 2, border: 'none', cursor: 'pointer', flexShrink: 0,
              fontWeight: 700, fontSize: 14,
              background: activeCategory === cat.key ? 'var(--border)' : 'transparent',
              color: activeCategory === cat.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.1s',
            }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* 지역 탭 (우리동네 카테고리일 때만) */}
      {activeCategory === 'local' && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '6px 8px', display: 'flex', gap: 3, marginBottom: 10,
          flexWrap: 'nowrap', overflowX: 'auto',
        }}>
          {REGIONS.map(r => {
            const isActive = activeRegion === r.value || (activeRegion === 'all' && r.value === 'all');
            return (
              <button key={r.value}
                onClick={() => {
                  const params = r.value === 'all' ? '?category=local' : `?category=local&region=${r.value}`;
                  router.push(`/feed${params}`);
                }}
                style={{
                  padding: '5px 10px', borderRadius: 2, border: 'none', cursor: 'pointer', flexShrink: 0,
                  fontWeight: 600, fontSize: 12,
                  background: isActive ? 'var(--brand)' : 'transparent',
                  color: isActive ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                  transition: 'all 0.1s',
                }}>
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 게시글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visiblePosts.map((post) => {
          const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
          const gradeEmoji = GRADE_EMOJI[post.profiles?.grade ?? 1] ?? '🌱';
          const isLiked = likedPosts.has(post.id);
          const displayLikes = likeCounts[post.id] ?? post.likes_count ?? 0;
          const isBookmarked = bookmarkedPosts.has(post.id);
          return (
            <Link key={post.id} href={`/feed/${post.id}`} className="animate-fadeIn kd-card"
              style={{ display: 'flex', textDecoration: 'none' }}>
              {/* 투표 */}
              <div
                onClick={(e) => handleUpvote(e, post.id)}
                style={{
                  width: 40, background: isLiked ? 'var(--brand)' : 'var(--bg-hover)', borderRadius: '4px 0 0 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '10px 4px', gap: 4, flexShrink: 0, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}>
                <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: `8px solid ${isLiked ? 'var(--text-inverse)' : 'var(--brand)'}` }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: isLiked ? 'var(--text-inverse)' : 'var(--brand)' }}>{numFmt(displayLikes)}</span>
                <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${isLiked ? 'var(--text-inverse)' : 'var(--border)'}` }} />
              </div>
              {/* 본문 */}
              <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, flexWrap: 'wrap' }}>
                  {post.profiles?.avatar_url ? (
                    <img src={post.profiles.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-inverse, #fff)' }}>
                      {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span>{gradeEmoji} <strong style={{ color: 'var(--text-primary)' }}>{post.profiles?.nickname ?? '익명'}</strong> · {timeAgo(post.created_at)}</span>
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 2, fontWeight: 700, background: cat.bg, color: cat.color }}>{cat.label}</span>
                  {((post.likes_count ?? 0) >= 100 || (post.view_count ?? 0) >= 1000) && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 2, fontWeight: 700, background: 'var(--error-bg)', color: 'var(--error)' }}>🔥 HOT</span>}
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                  {post.title}
                </h2>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                  {post.content}
                </p>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <div onClick={(e) => handleComment(e, post.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', borderRadius: 2, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    💬 댓글 {numFmt(post.comments_count ?? 0)}
                  </div>
                  <div onClick={(e) => handleShare(e, post)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', borderRadius: 2, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    🔗 공유
                  </div>
                  <div onClick={(e) => handleBookmark(e, post.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', borderRadius: 2, fontSize: 12, fontWeight: 700, color: isBookmarked ? 'var(--brand)' : 'var(--text-tertiary)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; if (!bookmarkedPosts.has(post.id)) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; if (!bookmarkedPosts.has(post.id)) (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                    {isBookmarked ? '🔖' : '🔖'} {isBookmarked ? '저장됨' : '저장'}
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', padding: '5px 4px', display:'flex', alignItems:'center', gap:4 }}>
                    👁 {numFmt(post.view_count ?? 0)}
                    <span style={{ fontSize:10, color:'var(--text-tertiary)', opacity:0.5 }}>kadeora.app</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {visibleCount < posts.length && (
        <div ref={observerRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} className="animate-spin" />
        </div>
      )}
      {posts.length === 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>게시글이 없습니다
        </div>
      )}
    </div>
  );
}
