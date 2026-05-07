import Link from 'next/link';

interface Props {
  counts: {
    active_subscription?: number;
    unsold?: number;
    redev?: number;
    trade?: number;
    complex?: number;
    calc?: number;
    [k: string]: number | undefined;
  };
}

interface Card {
  key: string;
  label: string;
  emoji: string;
  href: string;
  countKey?: string;
}

const CARDS: Card[] = [
  { key: 'subscription', label: '분양중', emoji: '🏗️', href: '/apt?category=subscription', countKey: 'active_subscription' },
  { key: 'unsold', label: '미분양', emoji: '💸', href: '/apt?category=unsold', countKey: 'unsold' },
  { key: 'redev', label: '재개발', emoji: '🏚️', href: '/apt?category=redev', countKey: 'redev' },
  { key: 'trade', label: '실거래', emoji: '📊', href: '/apt?category=trade', countKey: 'trade' },
  { key: 'complex', label: '단지백과', emoji: '📚', href: '/apt/complex', countKey: 'complex' },
  { key: 'calc', label: '가점계산기', emoji: '🧮', href: '/apt/diagnose', countKey: 'calc' },
];

export default function AptCategoryGrid({ counts }: Props) {
  return (
    <section
      aria-label="아파트 카테고리"
      style={{ maxWidth: 720, margin: '16px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
          padding: '0 4px',
        }}
      >
        카테고리
      </h2>

      <div
        className="apt-category-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {CARDS.map((c) => {
          const cnt = c.countKey ? counts?.[c.countKey] : undefined;
          return (
            <Link
              key={c.key}
              href={c.href}
              className="apt-category-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '14px 8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'inherit',
                aspectRatio: '1 / 1',
              }}
            >
              <span aria-hidden style={{ fontSize: 24 }}>
                {c.emoji}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {c.label}
              </span>
              {typeof cnt === 'number' && cnt > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {cnt.toLocaleString()}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
