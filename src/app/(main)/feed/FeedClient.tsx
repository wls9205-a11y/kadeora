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

const LOGO_SVG = (
  <svg width="32" height="32" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <rect width="64" height="64" rx="14" fill="#FF4500"/>
    <circle cx="11" cy="32" r="8.5" fill="#CC3700"/><circle cx="53" cy="32" r="8.5" fill="#CC3700"/>
    <circle cx="11" cy="32" r="5.5" fill="#FF7A50"/><circle cx="53" cy="32" r="5.5" fill="#FF7A50"/>
    <ellipse cx="32" cy="29" rx="19" ry="18" fill="#FF4500"/>
    <ellipse cx="32" cy="32" rx="15" ry="14" fill="#FF7A50"/>
    <circle cx="25" cy="27" r="6" fill="#fff"/><circle cx="39" cy="27" r="6" fill="#fff"/>
    <circle cx="25.5" cy="27.5" r="4" fill="#1A0800"/><circle cx="39.5" cy="27.5" r="4" fill="#1A0800"/>
    <circle cx="27" cy="26" r="1.6" fill="#fff"/><circle cx="41" cy="26" r="1.6" fill="#fff"/>
    <ellipse cx="32" cy="36" rx="5.5" ry="4" fill="#CC3700"/>
    <path d="M27 40.5 Q32 44.5 37 40.5" stroke="#CC3700" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

interface Props { posts: PostWithProfile[]; trending: TrendingKeyword[]; activeCategory: string; }

export default function FeedClient({ posts, trending, activeCategory }: Props) {
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
        {/* 커뮤니티 카드 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: 'var(--brand)', height: 56, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            {LOGO_SVG}
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-inverse, #fff)', letterSpacing: -0.5 }}>카더라</span>
          </div>
          <div style={{ padding: '32px 12px 12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -22, left: 12, width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--bg-surface)', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {LOGO_SVG}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>카더라 커뮤니티</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>대한민국 소리소문 정보 커뮤니티</div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
              {[['4','멤버'],['10','토론방'],['28','게시글']].map(([n,l]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{n}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l}</div>
                </div>
              ))}
            </div>
            <Link href="/write" style={{ display: 'block', textAlign: 'center', background: 'var(--brand)', color: 'var(--text-inverse, #fff)', borderRadius: 20, padding: '7px 0', fontSize: 13, fontWeight: 700 }}>
              + 새 게시글 작성
            </Link>
          </div>
        </div>

        {/* 인기 키워드 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: 'var(--brand)', padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-inverse, #fff)' }}>🔥 실시간 인기</div>
          <div style={{ padding: '6px 0' }}>
            {trending.map((kw, i) => (
              <Link key={kw.id} href={`/search?q=${encodeURIComponent(kw.keyword)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>#{kw.keyword}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{kw.heat_score >= 1000 ? (kw.heat_score / 1000).toFixed(1) + 'k' : kw.heat_score}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 빠른 메뉴 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: 'var(--brand)', padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-inverse, #fff)' }}>빠른 메뉴</div>
          {[['📝 새 글 작성','/write'],['💬 실시간 토론','/discuss'],['📈 주식 시세','/stock'],['🏠 청약 정보','/apt']].map(([l,h]) => (
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