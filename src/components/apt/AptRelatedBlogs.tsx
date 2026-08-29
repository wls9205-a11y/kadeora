// s273 — ⑤ 관련 블로그 분석.

import Link from 'next/link';
import type { RelatedBlogPost } from '@/lib/apt/related-blogs';
import SectionHeader, { SectionLink } from '@/components/apt/SectionHeader';

function fmtDate(d: string | null): string {
  if (!d) return '';
  const key = d.slice(0, 10);
  const [, m, day] = key.split('-');
  return m && day ? `${Number(m)}.${Number(day)}` : '';
}

export default function AptRelatedBlogs({ posts }: { posts: RelatedBlogPost[] }) {
  if (!posts.length) return null;

  return (
    <section style={{ margin: '24px 0 0', padding: '0 6px' }} aria-labelledby="apt-blogs-heading">
      <SectionHeader
        id="apt-blogs-heading"
        eyebrow="ANALYSIS — 관련 분석"
        title="관련 청약 분석"
      />

      <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/blog/${encodeURIComponent(p.slug)}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-sm)',
              padding: '10px 11px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            <span aria-hidden style={{ fontSize: 'var(--fs-sm)', flexShrink: 0 }}>
              📄
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  lineHeight: 1.45,
                  wordBreak: 'keep-all',
                }}
              >
                {p.title}
              </span>
              {p.published_at ? (
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                  {fmtDate(p.published_at)}
                  {p.apt_id ? ' · 단지 분석' : ''}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>

      <SectionLink href="/blog">청약 분석 전체 보기</SectionLink>
    </section>
  );
}
