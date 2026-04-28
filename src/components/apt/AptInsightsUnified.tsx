// 서버 — AI hero + 블로그 3 카드 통합.
import Link from 'next/link';
import type { AIAnalysisPost, BlogListRow } from '@/lib/apt-fetcher';

interface Props {
  region: string;
  aiPost: AIAnalysisPost | null;
  blogList: BlogListRow[];
}

function fmtDate(s: string | null): string {
  return s ? s.slice(0, 10) : '';
}

export default function AptInsightsUnified({ region, aiPost, blogList }: Props) {
  if (!aiPost && (!blogList || blogList.length === 0)) return null;

  return (
    <section
      aria-label={`${region} AI 분석 + 블로그`}
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        🤖 {region} AI 분석 & 블로그
      </h2>

      {/* AI hero — 시그니처 (보라색 그라데이션) */}
      {aiPost && (
        <Link
          href={`/blog/${encodeURIComponent(aiPost.slug)}`}
          style={{
            display: 'block', marginBottom: 10,
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.06) 100%)',
            border: '1px solid var(--border)', borderRadius: 12,
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {aiPost.cover_image ? (
              <img
                src={aiPost.cover_image} alt=""
                width={88} height={88}
                style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: 'var(--bg-hover)' }}
                loading="lazy" decoding="async"
              />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: 10, flexShrink: 0, background: 'rgba(139,92,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🤖</div>
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', letterSpacing: 1 }}>
                AI 분석 · {region}
              </span>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {aiPost.title}
              </h3>
              {aiPost.excerpt && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {aiPost.excerpt.slice(0, 140)}
                </p>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'auto' }}>
                {fmtDate(aiPost.published_at)}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* 블로그 3 카드 가로 */}
      {blogList && blogList.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 8,
          }}
        >
          {blogList.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${encodeURIComponent(p.slug)}`}
              style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
                overflow: 'hidden', textDecoration: 'none', color: 'inherit',
              }}
            >
              {p.cover_image ? (
                <img src={p.cover_image} alt={p.title} width={180} height={100}
                  style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', background: 'var(--bg-hover)' }}
                  loading="lazy" decoding="async" />
              ) : (
                <div style={{ height: 100, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--text-tertiary)' }}>📰</div>
              )}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <h4 style={{
                  margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--text-primary)',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35,
                }}>
                  {p.title}
                </h4>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {p.reading_minutes ? `${p.reading_minutes}분` : ''}
                  {p.view_count != null && p.view_count > 0 && ` · 조회 ${p.view_count.toLocaleString()}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
