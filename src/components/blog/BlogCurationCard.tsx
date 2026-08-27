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
  post, img, catLabel, catColor, cover, tone = 'surface',
}: {
  post: BlogCurationPost;
  img?: string;
  catLabel: string;
  catColor: string;
  /** 표지 이미지 URL. 없으면 이미지 자리를 만들지 않는다 (있는 척 금지). */
  cover?: string | null;
  /**
   * H5-3 — 'navy' 는 블로그 목록 «첫 카드» 전용이다.
   *
   * ⚠️ 한 화면에 네이비 덩어리는 «하나» 다. 블로그에서 그 하나가 이 카드다 —
   *    다른 곳에 navy 를 또 쓰면 화면이 무엇을 강조하는지 알 수 없게 된다.
   * ⚠️ 새 컴포넌트를 만들지 않고 프롭으로 갈랐다. 두 벌이 되면 카드 구조가 조용히 갈린다.
   *
   * 대비 실측(네이비 #0B2A6B 위): 제목 흰 13.48 · 골드 라벨 8.54 · 보조 흰0.70 7.31
   */
  tone?: 'surface' | 'navy';
}) {
  const src = cover || img || null;
  const navy = tone === 'navy';

  return (
    <article
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        background: navy ? 'var(--brand-navy)' : 'var(--bg-surface)',
        borderColor: navy ? 'var(--brand-navy)' : undefined,
        overflow: 'hidden',
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
        {/* ⚠️ 네이비 위에서는 카테고리색이 대부분 대비 미달이다. 골드로 통일한다(8.54). */}
        <span style={{ fontSize: 10, fontWeight: 500, color: navy ? 'var(--brand-gold)' : catColor, marginBottom: 4 }}>{catLabel}</span>

        <Link
          href={`/blog/${post.slug}`}
          style={{
            fontSize: 14, fontWeight: 600, lineHeight: 1.4, letterSpacing: '-.02em',
            color: navy ? 'var(--text-inverse)' : 'var(--text-primary)', textDecoration: 'none', wordBreak: 'keep-all',
            marginBottom: 5,
          }}
        >
          {post.title}
        </Link>

        {post.excerpt && (
          <p
            style={{
              margin: 0, fontSize: 11.5, lineHeight: 1.55,
              color: navy ? 'rgba(255,255,255,0.78)' : 'var(--text-secondary)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', wordBreak: 'keep-all',
            }}
          >
            {post.excerpt}
          </p>
        )}

        <span style={{ marginTop: 'auto', paddingTop: 8, fontSize: 10, color: navy ? 'rgba(255,255,255,0.70)' : 'var(--text-tertiary)' }}>
          {post.reading_time_min || 3}분 · 👀 {(post.view_count ?? 0).toLocaleString()}
        </span>
      </div>
    </article>
  );
}
