/**
 * RelatedBlogsSection — 블로그 상세 하단 "이어서 읽을 만한 글" 3개 카드.
 *
 * DB: match_related_blogs(p_blog_id bigint, p_limit int=3) → jsonb[]
 *   { id, title, slug, cover_image, reading_minutes, tldr, badge }
 *   badge ∈ 'strategy' | 'related'
 *
 * 서버 컴포넌트. 결과 0건 → null.
 * 사용자 이벤트 (view/click) 는 클라이언트 Tracker 컴포넌트로 위임.
 */

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import RelatedBlogsTracker from './RelatedBlogsTracker';

interface RelatedBlog {
  id: number;
  title: string;
  slug: string;
  cover_image?: string | null;
  reading_minutes?: number | null;
  tldr?: string | null;
  badge?: 'strategy' | 'related' | string | null;
}

async function fetchRelated(blogId: number, limit: number): Promise<RelatedBlog[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await (admin as any).rpc('match_related_blogs', {
      p_blog_id: blogId,
      p_limit: limit,
    });
    if (!Array.isArray(data)) return [];
    return data as RelatedBlog[];
  } catch {
    return [];
  }
}

interface Props {
  blogId: number;
  className?: string;
}

export default async function RelatedBlogsSection({ blogId, className }: Props) {
  if (!blogId) return null;
  const rows = await fetchRelated(blogId, 3);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="이어서 읽을 만한 글"
      className={className}
      style={{ margin: '24px 0' }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary, #e5e7eb)' }}>
          이어서 읽을 만한 글
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary, #94a3b8)', margin: 0 }}>
          블로그 2글 이상 본 분들, 가입률 6.5배 (실측)
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {rows.map((r) => {
          const isStrategy = r.badge === 'strategy';
          const cover = r.cover_image || `/api/og?title=${encodeURIComponent(r.title || 'kadeora')}&category=blog`;
          return (
            <Link
              key={r.id}
              href={`/blog/${r.slug}`}
              data-related-card
              data-related-badge={isStrategy ? 'strategy' : 'related'}
              data-related-blog-id={r.id}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                border: isStrategy ? '1px solid rgba(245,158,11,0.55)' : '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: 12,
                overflow: 'hidden',
                background: isStrategy
                  ? 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(255,255,255,0.02) 100%)'
                  : 'var(--bg-surface, #0f172a)',
                boxShadow: isStrategy ? '0 10px 24px rgba(245,158,11,0.12)' : '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'transform 0.12s ease',
              }}
            >
              <div
                style={{
                  aspectRatio: '16 / 9',
                  background: `url('${cover}') center/cover no-repeat, rgba(255,255,255,0.03)`,
                  position: 'relative',
                }}
                aria-hidden
              >
                {isStrategy && (
                  <span
                    style={{
                      position: 'absolute', top: 8, left: 8,
                      padding: '3px 8px', borderRadius: 999,
                      background: '#F59E0B', color: '#111',
                      fontSize: 10, fontWeight: 800,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    ⚡ 전략
                  </span>
                )}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-primary, #e5e7eb)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'keep-all',
                  }}
                >
                  {r.title}
                </div>
                {r.tldr && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: 'var(--text-tertiary, #94a3b8)',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.tldr}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary, #94a3b8)' }}>
                  {r.reading_minutes && <span>⏱ {r.reading_minutes}분</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <RelatedBlogsTracker blogId={blogId} />
    </section>
  );
}
