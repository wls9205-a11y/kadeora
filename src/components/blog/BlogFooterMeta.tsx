import Link from 'next/link';

type Props = {
  tags?: string[] | null;
  category?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  rewrittenAt?: string | null;
};

export default function BlogFooterMeta({ tags, category, createdAt, updatedAt, rewrittenAt }: Props) {
  const cleanTags = (tags ?? []).filter(Boolean).slice(0, 12);
  const fmt = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return null; }
  };
  const created = fmt(createdAt);
  const modified = fmt(updatedAt || rewrittenAt);
  const hasModified = modified && created && modified !== created;

  if (!cleanTags.length && !created && !modified) return null;

  return (
    <section
      aria-label="포스트 메타 정보"
      style={{
        marginTop: 32,
        padding: '16px 14px',
        borderTop: '1px solid var(--border)',
        background: 'var(--blog-tag-bg, rgba(59,123,246,0.03))',
        borderRadius: 'var(--radius-card)',
      }}
    >
      {cleanTags.length > 0 && (
        <div
          role="list"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: (created || modified) ? 14 : 0,
          }}
        >
          {cleanTags.map((t) => (
            <Link
              key={t}
              href={`/blog?tag=${encodeURIComponent(t)}`}
              role="listitem"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'var(--blog-tag-bg, rgba(59,123,246,0.08))',
                color: 'var(--blog-tag-color, var(--brand))',
                border: '0.5px solid var(--blog-info-box-border, rgba(59,123,246,0.15))',
                textDecoration: 'none',
                fontWeight: 600,
                letterSpacing: '-0.2px',
              }}
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {(created || modified) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {created && (
            <span>
              📅 최초 <time dateTime={createdAt || undefined}>{created}</time>
            </span>
          )}
          {hasModified && (
            <span>
              ✏️ 수정 <time dateTime={(updatedAt || rewrittenAt) || undefined}>{modified}</time>
            </span>
          )}
          {category && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
              #{category}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
