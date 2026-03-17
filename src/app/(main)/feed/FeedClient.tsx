'use client';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import { CATEGORY_MAP } from '@/lib/constants';

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

interface Props { posts: PostWithProfile[]; trending: TrendingKeyword[]; activeCategory: string; }

export default function FeedClient({ posts, activeCategory }: Props) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(10);
  const observerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibleCount(c => Math.min(c + 10, posts.length)); },
      { threshold: 0.1 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [posts.length]);

  const categories = [
    { key: 'all', label: '전체' }, { key: 'stock', label: '주식' },
    { key: 'apt', label: '부동산' }, { key: 'free', label: '자유' },
  ];
  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div className="feed-layout">
      {/* ── 메인 피드 ── */}
      <div className="feed-main">
        {/* 카테고리 바 */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '8px 10px', display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap',
        }}>
          {categories.map(cat => (
            <button key={cat.key} aria-pressed={activeCategory === cat.key}
              onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
              style={{
                padding: '7px 14px', borderRadius: 2, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14,
                background: activeCategory === cat.key ? 'var(--border)' : 'transparent',
                color: activeCategory === cat.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.1s',
              }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* 게시글 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visiblePosts.map((post, i) => {
            const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
            return (
              <Link key={post.id} href={`/feed/${post.id}`} className="animate-fadeIn kd-card"
                style={{ display: 'flex', textDecoration: 'none' }}>
                {/* 투표 */}
                <div style={{
                  width: 40, background: 'var(--bg-hover)', borderRadius: '4px 0 0 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '10px 4px', gap: 4, flexShrink: 0,
                }}>
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid var(--brand)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>{numFmt(post.likes_count ?? 0)}</span>
                  <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid var(--border)' }} />
                </div>
                {/* 본문 */}
                <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, flexWrap: 'wrap' }}>
                    {post.profiles?.avatar_url ? (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                        <Image src={post.profiles.avatar_url} alt="" fill sizes="18px" style={{ objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-inverse, #fff)' }}>
                        {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span>r/<strong style={{ color: 'var(--text-primary)' }}>{cat.label}</strong> · u/<strong style={{ color: 'var(--text-primary)' }}>{post.profiles?.nickname ?? '익명'}</strong> · {timeAgo(post.created_at)}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 2, fontWeight: 700, background: cat.bg, color: cat.color }}>{cat.label}</span>
                    {(post.likes_count ?? 0) > 200 && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 2, fontWeight: 700, background: 'var(--error-bg)', color: 'var(--error)' }}>🔥 HOT</span>}
                  </div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                    {post.title}
                  </h2>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                    {post.content}
                  </p>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {[['💬', `댓글 ${numFmt(post.comments_count ?? 0)}`], ['🔗', '공유'], ['🔖', '저장']].map(([icon, label]) => (
                      <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', borderRadius: 2, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                        {icon} {label}
                      </div>
                    ))}
                    <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', padding: '5px 4px' }}>👁 {numFmt(post.view_count ?? 0)}</div>
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

      {/* ── 사이드바 (1024px+ 에서만 표시) ── */}
      <aside className="feed-sidebar">
        {/* 빠른 메뉴 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: 'var(--brand)', padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-inverse, #fff)' }}>빠른 메뉴</div>
          {[['📝 새 글 작성','/write'],['📈 주식 시세','/stock'],['🏠 청약 정보','/apt']].map(([l,h]) => (
            <Link key={h as string} href={h as string} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {l}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}