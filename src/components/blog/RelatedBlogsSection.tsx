/**
 * RelatedBlogsSection — "이어서 읽을 만한 글" 4카드 (2x2 그리드).
 *
 * DB: match_related_blogs(p_blog_id bigint, p_limit int=4) → jsonb[]
 *   { id, title, slug, cover_image, reading_minutes, tldr, badge, category, view_count }
 *   badge ∈ 'strategy' | 'related'
 *
 * 디자인: 카테고리 이모지 아이콘 + 제목 + 카테고리 + 조회수
 * 모바일은 1열, 데스크탑 1024px+ 2열.
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
  category?: string | null;
  view_count?: number | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  apt: '🏗️',
  unsold: '🏚️',
  stock: '📈',
  finance: '💡',
  general: '📰',
};

const CATEGORY_LABEL: Record<string, string> = {
  apt: '청약·분양',
  unsold: '미분양',
  stock: '주식',
  finance: '재테크',
  general: '생활',
};

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
  const rows = await fetchRelated(blogId, 4);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="이어서 읽을 만한 글"
      className={className}
      style={{ margin: '24px 0' }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          이어서 읽을 만한 글
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
          블로그 2글 이상 본 분들, 가입률 6.5배 (실측)
        </p>
      </div>
      <div className="kd-related-grid">
        {rows.map((r) => {
          const isStrategy = r.badge === 'strategy';
          const cat = r.category || '';
          const emoji = CATEGORY_EMOJI[cat] || '📰';
          const catLabel = CATEGORY_LABEL[cat] || cat;
          const views = Number(r.view_count ?? 0);
          return (
            <Link
              key={r.id}
              href={`/blog/${r.slug}`}
              data-related-card
              data-related-badge={isStrategy ? 'strategy' : 'related'}
              data-related-blog-id={r.id}
              className="kd-related-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '14px 14px 12px',
                textDecoration: 'none',
                color: 'inherit',
                border: isStrategy
                  ? '1px solid rgba(245,158,11,0.55)'
                  : '1px solid var(--border)',
                borderRadius: 16,
                background: isStrategy
                  ? 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, var(--bg-surface) 100%)'
                  : 'var(--bg-surface)',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }} aria-hidden>{emoji}</span>
                {isStrategy && (
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    padding: '2px 8px', borderRadius: 999,
                    background: '#F59E0B', color: '#111',
                  }}>⚡ 전략</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'keep-all',
                }}
              >
                {r.title}
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {catLabel && <span style={{ fontWeight: 600 }}>{catLabel}</span>}
                {views > 0 && <span>👁️ {views.toLocaleString()}</span>}
                {r.reading_minutes ? <span>⏱ {r.reading_minutes}분</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.kd-related-grid{display:grid;grid-template-columns:1fr;gap:12px}@media (min-width:768px){.kd-related-grid{grid-template-columns:1fr 1fr;gap:14px}}@media (hover:hover){.kd-related-card:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(0,0,0,0.18);border-color:var(--blog-info-box-border,var(--border))}}` }} />
      <RelatedBlogsTracker blogId={blogId} />
    </section>
  );
}
