// v3 커밋5 — /blog 상단 큐레이션 카드 (3편).
//
// 목록 행(.kd-lrow)에서 뺀 것 — 썸네일과 요약 — 을 여기서만 편다.
// 목록 16건 전부에 요약을 붙이면 모바일에서 전부 한 줄 말줄임으로 잘려 정보가 0이 된다.
// 3편에만 붙이면 실제로 읽힌다.

import Link from 'next/link';

export type BlogCurationPost = {
  id: string | number;
  slug: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  cover_image?: string | null;
  reading_time_min?: number | null;
  view_count?: number | null;
};

export default function BlogCurationCard({
  post, img, catLabel, catColor, cover,
}: {
  post: BlogCurationPost;
  img?: string;
  catLabel: string;
  catColor: string;
  /** 표지 이미지 URL. 없으면 이미지 자리를 만들지 않는다 (있는 척 금지). */
  cover?: string | null;
}) {
  const src = cover || img || null;

  return (
    <article
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)', overflow: 'hidden',
      }}
    >
      {src && (
        <Link href={`/blog/${post.slug}`} style={{ display: 'block', aspectRatio: '16 / 9', background: 'var(--bg-hover)' }}>
          <img
            src={src}
            alt=""
            width={480}
            height={270}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
            decoding="async"
          />
        </Link>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '11px 13px 12px' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: catColor, marginBottom: 4 }}>{catLabel}</span>

        <Link
          href={`/blog/${post.slug}`}
          style={{
            fontSize: 14, fontWeight: 600, lineHeight: 1.4, letterSpacing: '-.02em',
            color: 'var(--text-primary)', textDecoration: 'none', wordBreak: 'keep-all',
            marginBottom: 5,
          }}
        >
          {post.title}
        </Link>

        {post.excerpt && (
          <p
            style={{
              margin: 0, fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-secondary)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', wordBreak: 'keep-all',
            }}
          >
            {post.excerpt}
          </p>
        )}

        <span style={{ marginTop: 'auto', paddingTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
          {post.reading_time_min || 3}분 · 👀 {(post.view_count ?? 0).toLocaleString()}
        </span>
      </div>
    </article>
  );
}
