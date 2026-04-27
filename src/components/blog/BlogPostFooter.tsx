import Link from 'next/link';

interface Props {
  tags?: string[] | null;
  authorName?: string | null;
  authorAvatar?: string | null;
  authorBio?: string | null;
  authorSlug?: string | null;
  showDisclaimer?: boolean;
}

export default function BlogPostFooter({
  tags,
  authorName,
  authorAvatar,
  authorBio,
  authorSlug,
  showDisclaimer = true,
}: Props) {
  const hasTags = Array.isArray(tags) && tags.length > 0;
  const hasAuthor = !!authorName;

  return (
    <footer style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
      {hasTags && (
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--text-tertiary)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            태그
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags!.slice(0, 12).map(tag => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {hasAuthor && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: 14,
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            marginBottom: 22,
          }}
        >
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName!}
              width={44}
              height={44}
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--brand)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {authorName![0]?.toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>작성자</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
              {authorSlug ? (
                <Link
                  href={`/profile/${encodeURIComponent(authorSlug)}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {authorName}
                </Link>
              ) : (
                authorName
              )}
            </div>
            {authorBio && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                {authorBio}
              </div>
            )}
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            lineHeight: 1.7,
            padding: '10px 12px',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          본 콘텐츠는 정보 제공 목적으로 작성되었으며, 투자 권유 또는 청약·매수 권유가 아닙니다.
          최종 의사결정은 본인의 판단과 책임 하에 이루어져야 합니다.
        </div>
      )}
    </footer>
  );
}
