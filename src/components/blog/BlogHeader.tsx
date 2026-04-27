import Link from 'next/link';

export type BlogCategory = 'apt' | 'finance' | 'general' | 'redev' | 'stock' | 'unsold';

export interface BlogHeaderProps {
  title: string;
  subtitle?: string | null;
  category?: BlogCategory | string | null;
  authorName?: string | null;
  authorAvatar?: string | null;
  publishedAt?: string | null;
  readingMinutes?: number | null;
}

const CAT_META: Record<BlogCategory, { label: string; color: string; bg: string; emoji: string }> = {
  apt:     { label: '청약·분양',  color: '#00FF87', bg: 'rgba(0,255,135,.14)',   emoji: '🏢' },
  redev:   { label: '재개발',      color: '#B794FF', bg: 'rgba(183,148,255,.14)', emoji: '🏗️' },
  unsold:  { label: '미분양',      color: '#FF6B1A', bg: 'rgba(255,107,26,.14)',  emoji: '⚠️' },
  stock:   { label: '주식·시세',  color: '#00E5FF', bg: 'rgba(0,229,255,.14)',   emoji: '📈' },
  finance: { label: '재테크',      color: '#FFE000', bg: 'rgba(255,224,0,.14)',   emoji: '💰' },
  general: { label: '생활정보',    color: '#C084FC', bg: 'rgba(192,132,252,.14)', emoji: '📰' },
};

function isCategory(c: unknown): c is BlogCategory {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(CAT_META, c);
}

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function BlogHeader({
  title,
  subtitle,
  category,
  authorName,
  authorAvatar,
  publishedAt,
  readingMinutes,
}: BlogHeaderProps) {
  const meta = isCategory(category) ? CAT_META[category] : CAT_META.general;
  const dateStr = fmtDate(publishedAt);

  return (
    <header style={{ margin: '0 0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Link
          href={`/blog?category=${isCategory(category) ? category : 'general'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            fontSize: 12,
            fontWeight: 800,
            textDecoration: 'none',
            border: `1px solid ${meta.color}40`,
          }}
        >
          <span>{meta.emoji}</span>
          {meta.label}
        </Link>
      </div>
      <h1
        style={{
          fontSize: 'clamp(24px, 5vw, 34px)',
          fontWeight: 900,
          lineHeight: 1.25,
          letterSpacing: -0.6,
          margin: '0 0 10px',
          color: 'var(--text-primary)',
          wordBreak: 'keep-all',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 14px',
            wordBreak: 'keep-all',
          }}
        >
          {subtitle}
        </p>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          flexWrap: 'wrap',
        }}
      >
        {authorName && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                width={20}
                height={20}
                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: meta.color,
                  color: '#000',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {authorName[0]?.toUpperCase()}
              </span>
            )}
            <span>{authorName}</span>
          </span>
        )}
        {dateStr && <span>{dateStr}</span>}
        {readingMinutes ? <span>· {readingMinutes}분 읽기</span> : null}
      </div>
    </header>
  );
}
