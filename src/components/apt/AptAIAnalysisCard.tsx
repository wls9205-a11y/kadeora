// 서버 — region 태그 포함 최신 블로그 글 1개를 카드로.
import Link from 'next/link';
import type { AIAnalysisPost } from '@/lib/apt-fetcher';

interface Props {
  post: AIAnalysisPost;
  region: string;
}

function fmtDate(s: string | null): string {
  if (!s) return '';
  return s.slice(0, 10);
}

export default function AptAIAnalysisCard({ post, region }: Props) {
  return (
    <section
      aria-label="AI 분석"
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <Link
        href={`/blog/${encodeURIComponent(post.slug)}`}
        style={{
          display: 'flex', gap: 12,
          padding: 12,
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
          textDecoration: 'none', color: 'inherit',
        }}
      >
        {post.cover_image ? (
          <img
            src={post.cover_image} alt=""
            width={88} height={88}
            style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: 'var(--bg-hover)' }}
            loading="lazy" decoding="async"
          />
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: 8, flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 22 }}>📰</div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', letterSpacing: 1 }}>
            {region} · AI 분석
          </span>
          <h3 style={{
            margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35,
          }}>
            {post.title}
          </h3>
          {post.excerpt && (
            <p style={{
              margin: 0, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {post.excerpt.slice(0, 120)}
            </p>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'auto' }}>
            {fmtDate(post.published_at)}
          </span>
        </div>
      </Link>
    </section>
  );
}
