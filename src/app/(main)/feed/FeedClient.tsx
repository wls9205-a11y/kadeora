'use client';
import { useState, useRef, useCallback } from 'react';
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

interface Props {
  posts: PostWithProfile[];
  trending: TrendingKeyword[];
  activeCategory: string;
  isDemo: boolean;
}

export default function FeedClient({ posts, trending, activeCategory, isDemo }: Props) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(10);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
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
    { key: 'all', label: '전체' },
    { key: 'stock', label: '주식' },
    { key: 'apt', label: '청약' },
    { key: 'free', label: '자유' },
  ];

  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}
      className="lg:grid-cols-[1fr_280px]"
    >
      {/* Main feed */}
      <div>
        {/* Category filter */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 20,
          background: '#111827', borderRadius: 12,
          padding: 6, border: '1px solid #1E293B',
        }}>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                background: activeCategory === cat.key ? '#3B82F6' : 'transparent',
                color: activeCategory === cat.key ? 'white' : '#94A3B8',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                transition: 'all 0.15s',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Demo banner */}
        {isDemo && (
          <div style={{
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            💡 <span>현재 미리보기 데이터를 표시하고 있습니다. DB 연결 시 실제 데이터로 표시됩니다.</span>
          </div>
        )}

        {/* Post list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visiblePosts.map((post, i) => {
            const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
            return (
              <Link
                key={post.id}
                href={`/feed/${post.id}`}
                style={{ textDecoration: 'none' }}
                className="animate-fadeIn"
              >
                <article style={{
                  background: '#111827', border: '1px solid #1E293B',
                  borderRadius: 14, padding: '16px 18px',
                  transition: 'border-color 0.15s, transform 0.15s',
                  cursor: 'pointer',
                  animationDelay: `${i * 30}ms`,
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#334155';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#1E293B';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: 'white',
                    }}>
                      {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>
                          {post.profiles?.nickname ?? '익명'}
                        </span>
                        <span style={{
                          fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 600,
                          background: cat.bg, color: cat.color,
                        }}>{cat.label}</span>
                        <span style={{ fontSize: 11, color: '#64748B', marginLeft: 'auto' }}>
                          {timeAgo(post.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h2 style={{
                    margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#F1F5F9',
                    lineHeight: 1.4, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {post.title}
                  </h2>

                  <p style={{
                    margin: '0 0 12px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {post.content}
                  </p>

                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748B' }}>
                    <span>👁️ {numFmt(post.view_count)}</span>
                    <span>❤️ {numFmt(post.likes_count)}</span>
                    <span>💬 {numFmt(post.comments_count)}</span>
                    {post.likes_count > 200 && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 11, padding: '1px 8px', borderRadius: 999,
                        background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 700,
                      }}>🔥 HOT</span>
                    )}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        {/* Infinite scroll loader */}
        {visibleCount < posts.length && (
          <div ref={observerRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, border: '2px solid #1E293B', borderTopColor: '#3B82F6', borderRadius: '50%' }}
              className="animate-spin" />
          </div>
        )}

        {posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div>게시글이 없습니다</div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:block">
        {/* Trending */}
        <div style={{
          background: '#111827', border: '1px solid #1E293B',
          borderRadius: 14, padding: '16px 18px', marginBottom: 16,
          position: 'sticky', top: 80,
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔥 트렌딩 키워드
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trending.map((kw, i) => (
              <Link
                key={kw.id}
                href={`/search?q=${encodeURIComponent(kw.keyword)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
              >
                <span style={{
                  width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                  color: i < 3 ? '#EF4444' : '#64748B',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  flex: 1, fontSize: 13, color: '#CBD5E1', fontWeight: 500,
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#3B82F6')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
                >
                  {kw.keyword}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{(kw.count / 1000).toFixed(1)}k</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 14, padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>빠른 메뉴</h3>
          {[
            { href: '/write', label: '✏️ 글 작성하기', color: '#3B82F6' },
            { href: '/discuss', label: '💬 토론방 입장', color: '#8B5CF6' },
            { href: '/stock', label: '📈 실시간 주가', color: '#10B981' },
            { href: '/apt', label: '🏠 청약 정보', color: '#F59E0B' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
              borderBottom: '1px solid #1E293B', color: item.color, textDecoration: 'none',
              fontSize: 13, fontWeight: 500,
            }}>
              {item.label}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
