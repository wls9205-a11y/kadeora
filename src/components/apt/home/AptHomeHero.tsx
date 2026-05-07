import Link from 'next/link';

interface Props {
  region: string;
  sigungu?: string | null;
  kpis: any;
}

export default function AptHomeHero({ region, sigungu, kpis }: Props) {
  const imminentCount =
    (kpis && (kpis.imminent_d7 ?? kpis.imminent ?? kpis.active_sub_d7)) ?? null;
  const regionLabel = [region, sigungu].filter(Boolean).join(' ');

  return (
    <section
      className="apt-home-hero"
      aria-label={`${regionLabel} 청약 요약`}
      style={{
        maxWidth: 720,
        margin: '12px auto',
        padding: '20px 18px',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.04) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Link
          href="/apt/region"
          aria-label="지역 선택"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.05)',
            border: '0.5px solid var(--border)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span aria-hidden>📍</span>
          <span>{regionLabel || '전국'}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            letterSpacing: 0.3,
          }}
        >
          이번 주 청약
        </span>
        {typeof imminentCount === 'number' ? (
          <>
            <span
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: -1.5,
                lineHeight: 1,
              }}
            >
              {imminentCount.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-secondary)',
              }}
            >
              개
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: -0.5,
            }}
          >
            진행 중
          </span>
        )}
      </div>

      <p
        style={{
          margin: '6px 0 0',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          lineHeight: 1.5,
        }}
      >
        D-7 임박 단지를 한눈에 · 분양·미분양·재개발·실거래까지
      </p>
    </section>
  );
}
