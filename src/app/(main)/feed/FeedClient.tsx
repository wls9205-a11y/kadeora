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

function numFmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

const LOGO_SVG = (
  <svg width="32" height="32" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <rect width="64" height="64" rx="14" fill="#FF4500"/>
    <circle cx="11" cy="32" r="8.5" fill="#CC3700"/>
    <circle cx="53" cy="32" r="8.5" fill="#CC3700"/>
    <circle cx="11" cy="32" r="5.5" fill="#FF7A50"/>
    <circle cx="53" cy="32" r="5.5" fill="#FF7A50"/>
    <ellipse cx="32" cy="29" rx="19" ry="18" fill="#FF4500"/>
    <ellipse cx="32" cy="32" rx="15" ry="14" fill="#FF7A50"/>
    <circle cx="25" cy="27" r="6" fill="#fff"/>
    <circle cx="39" cy="27" r="6" fill="#fff"/>
    <circle cx="25.5" cy="27.5" r="4" fill="#1A0800"/>
    <circle cx="39.5" cy="27.5" r="4" fill="#1A0800"/>
    <circle cx="27" cy="26" r="1.6" fill="#fff"/>
    <circle cx="41" cy="26" r="1.6" fill="#fff"/>
    <circle cx="23.5" cy="29.5" r="0.8" fill="#fff"/>
    <circle cx="37.5" cy="29.5" r="0.8" fill="#fff"/>
    <ellipse cx="32" cy="36" rx="5.5" ry="4" fill="#CC3700"/>
    <ellipse cx="29.8" cy="35.5" rx="1.4" ry="1.1" fill="#8B1A00" fillOpacity="0.7"/>
    <ellipse cx="34.2" cy="35.5" rx="1.4" ry="1.1" fill="#8B1A00" fillOpacity="0.7"/>
    <path d="M27 40.5 Q32 44.5 37 40.5" stroke="#CC3700" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

interface Props {
  posts: PostWithProfile[];
  trending: TrendingKeyword[];
  activeCategory: string;
  isDemo: boolean;
}

export default function FeedClient({ posts, trending, activeCategory, isDemo }: Props) {
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
    { key: 'all', label: '전체', icon: '🏠' },
    { key: 'stock', label: '주식', icon: '📈' },
    { key: 'apt', label: '부동산', icon: '🏠' },
    { key: 'free', label: '자유', icon: '💬' },
  ];

  const visiblePosts = posts.slice(0, visibleCount);

  const cardBase: React.CSSProperties = {
    background: 'var(--kd-surface)',
    border: '1px solid var(--kd-border)',
    borderRadius: 4,
    display: 'flex',
    cursor: 'pointer',
    transition: 'border-color 0.1s',
    textDecoration: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: 24 }}>

      {/* ── 메인 피드 ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* 정렬/카테고리 바 */}
        <div style={{
          background: 'var(--kd-surface)',
          border: '1px solid var(--kd-border)',
          borderRadius: 4,
          padding: '10px 12px',
          display: 'flex',
          gap: 4,
          marginBottom: 10,
        }}>
          {categories.map(cat => (
            <button
              key={cat.key}
              aria-pressed={activeCategory === cat.key}
              onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 2,
                background: activeCategory === cat.key ? 'var(--kd-border)' : 'transparent',
                color: activeCategory === cat.key ? 'var(--kd-text)' : 'var(--kd-text-muted)',
                border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => {
                if (activeCategory !== cat.key)
                  (e.currentTarget as HTMLElement).style.background = 'var(--kd-border)';
              }}
              onMouseLeave={e => {
                if (activeCategory !== cat.key)
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 데모 배너 */}
        {isDemo && (
          <div style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 4, padding: '10px 14px', marginBottom: 10,
            fontSize: 13, color: 'var(--kd-primary)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ℹ <span>지금은 데모 데이터를 표시하고 있습니다. DB 연결 후 실제 데이터로 표시됩니다.</span>
          </div>
        )}

        {/* 게시글 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visiblePosts.map((post, i) => {
            const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
            return (
              <Link
                key={post.id}
                href={`/feed/${post.id}`}
                style={cardBase}
                className="animate-fadeIn"
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--kd-text-muted)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--kd-border)';
                }}
              >
                {/* 투표 컬럼 */}
                <div style={{
                  width: 40, background: 'var(--kd-surface-2, var(--kd-border))',
                  borderRadius: '4px 0 0 4px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', padding: '8px 4px', gap: 4, flexShrink: 0,
                }}>
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: '8px solid #FF4500',
                    cursor: 'pointer',
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FF4500' }}>
                    {numFmt(post.likes_count ?? 0)}
                  </span>
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '8px solid var(--kd-border)',
                    cursor: 'pointer',
                  }} />
                </div>

                {/* 본문 */}
                <div style={{ flex: 1, padding: '8px 10px 8px 12px', minWidth: 0 }}>
                  {/* 메타 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: 'var(--kd-text-dim)', marginBottom: 6, flexWrap: 'wrap',
                  }}>
                    {post.profiles?.avatar_url ? (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                        <Image src={post.profiles.avatar_url} alt={post.profiles.nickname ?? '유저'} fill sizes="20px" style={{ objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: '#FF4500',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: 'white',
                      }}>
                        {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span>
                      r/<strong style={{ color: 'var(--kd-text)' }}>{cat.label}</strong>
                      {' · '}
                      u/<strong style={{ color: 'var(--kd-text)' }}>{post.profiles?.nickname ?? '익명'}</strong>
                      {' · '}
                      {timeAgo(post.created_at)}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '1px 7px', borderRadius: 2, fontWeight: 700,
                      background: cat.bg, color: cat.color, marginLeft: 2,
                    }}>{cat.label}</span>
                    {(post.likes_count ?? 0) > 200 && (
                      <span style={{
                        fontSize: 11, padding: '1px 7px', borderRadius: 2, fontWeight: 700,
                        background: 'var(--kd-danger-dim)', color: 'var(--kd-danger)',
                      }}>🔥 HOT</span>
                    )}
                  </div>

                  {/* 제목 */}
                  <h2 style={{
                    margin: '0 0 4px', fontSize: 18, fontWeight: 500,
                    color: 'var(--kd-text)', lineHeight: 1.3,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {post.title}
                  </h2>

                  {/* 본문 미리보기 */}
                  <p style={{
                    margin: '0 0 8px', fontSize: 13,
                    color: 'var(--kd-text-muted)', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {post.content}
                  </p>

                  {/* 액션 */}
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[
                      { icon: '💬', label: `댓글 ${numFmt(post.comments_count ?? 0)}` },
                      { icon: '🔗', label: '공유' },
                      { icon: '🔖', label: '저장' },
                    ].map(btn => (
                      <div key={btn.label} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '6px 8px', borderRadius: 2,
                        fontSize: 12, fontWeight: 700, color: 'var(--kd-text-dim)',
                        cursor: 'pointer',
                      }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = 'var(--kd-border)';
                          (e.currentTarget as HTMLElement).style.color = 'var(--kd-text)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = 'var(--kd-text-dim)';
                        }}
                      >
                        {btn.icon} {btn.label}
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 8px', borderRadius: 2,
                      fontSize: 12, color: 'var(--kd-text-dim)', marginLeft: 'auto',
                    }}>
                      👁 {numFmt(post.view_count ?? 0)}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 무한스크롤 트리거 */}
        {visibleCount < posts.length && (
          <div ref={observerRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
            <div style={{
              width: 24, height: 24, border: '2px solid var(--kd-border)',
              borderTopColor: '#FF4500', borderRadius: '50%',
            }} className="animate-spin" />
          </div>
        )}

        {posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--kd-text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div>게시글이 없습니다</div>
          </div>
        )}
      </div>

      {/* ── 사이드바 ── */}
      <aside className="hidden lg:block" style={{ width: 312, flexShrink: 0 }}>

        {/* 커뮤니티 소개 카드 */}
        <div style={{
          background: 'var(--kd-surface)',
          border: '1px solid var(--kd-border)',
          borderRadius: 4, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            background: '#FF4500', height: 64,
            display: 'flex', alignItems: 'center', padding: '0 14px',
          }}>
            {LOGO_SVG}
            <span style={{ marginLeft: 8, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
              kadeora
            </span>
          </div>
          <div style={{ padding: '36px 14px 14px', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: -24, left: 14,
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid var(--kd-surface)',
              background: '#FF4500',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {LOGO_SVG}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--kd-text)', marginBottom: 4 }}>r/kadeora</div>
            <div style={{ fontSize: 13, color: 'var(--kd-text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              대한민국 No.1 커뮤니티 — 주식, 부동산, 청약, 자유게시판에서 실시간 정보를 나눠요.
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {[
                { num: '4', label: '멤버' },
                { num: '10', label: '토론방' },
                { num: '28', label: '게시글' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--kd-text)' }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: 'var(--kd-text-dim)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <Link href="/write" style={{
              display: 'block', width: '100%', textAlign: 'center',
              background: '#FF4500', color: '#fff', border: 'none',
              borderRadius: 20, padding: '8px 0', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none',
            }}>
              + 새 게시글 작성
            </Link>
          </div>
        </div>

        {/* 트렌딩 키워드 */}
        <div style={{
          background: 'var(--kd-surface)',
          border: '1px solid var(--kd-border)',
          borderRadius: 4, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            background: '#FF4500', padding: '10px 14px',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>🔥 인기 키워드</div>
          <div style={{ padding: '8px 0' }}>
            {trending.map((kw, i) => (
              <Link key={kw.id} href={`/search?q=${encodeURIComponent(kw.keyword)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', textDecoration: 'none',
                  borderBottom: i < trending.length - 1 ? '1px solid var(--kd-border)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--kd-border)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <span style={{
                  width: 24, fontSize: 13, fontWeight: 800, flexShrink: 0,
                  color: i < 3 ? '#FF4500' : 'var(--kd-text-dim)',
                }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--kd-text)', fontWeight: 500 }}>
                  #{kw.keyword}
                </span>
                <span style={{ fontSize: 11, color: 'var(--kd-text-dim)' }}>
                  {kw.heat_score >= 1000 ? (kw.heat_score / 1000).toFixed(1) + 'k' : kw.heat_score}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 빠른 링크 */}
        <div style={{
          background: 'var(--kd-surface)',
          border: '1px solid var(--kd-border)',
          borderRadius: 4, overflow: 'hidden',
          position: 'sticky', top: 80,
        }}>
          <div style={{
            background: '#FF4500', padding: '10px 14px',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>빠른 메뉴</div>
          <div style={{ padding: '4px 0' }}>
            {[
              { href: '/write', label: '📝 새 글 작성하기' },
              { href: '/discuss', label: '💬 실시간 토론방' },
              { href: '/stock', label: '📈 실시간 주식시세' },
              { href: '/apt', label: '🏠 청약 정보' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--kd-border)',
                color: 'var(--kd-text)', textDecoration: 'none',
                fontSize: 13, fontWeight: 500, transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--kd-border)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}