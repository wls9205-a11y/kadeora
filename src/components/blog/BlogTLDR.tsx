export interface TldrKpi {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat' | null;
  hint?: string | null;
}

interface Props {
  kpis: TldrKpi[];
  heading?: string;
}

const TREND_COLOR: Record<NonNullable<TldrKpi['trend']>, string> = {
  up: '#FF6B6B',
  down: '#00BFFF',
  flat: '#9CA3AF',
};
const TREND_ICON: Record<NonNullable<TldrKpi['trend']>, string> = {
  up: '▲',
  down: '▼',
  flat: '•',
};

export default function BlogTLDR({ kpis, heading = '한눈에 보기' }: Props) {
  if (!kpis || kpis.length === 0) return null;
  const cards = kpis.slice(0, 4);
  return (
    <section
      style={{
        margin: '20px 0 28px',
        padding: '16px 16px 14px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
        border: '1px solid var(--border)',
        borderRadius: 14,
      }}
    >
      <h3
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: 'var(--text-tertiary)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}
      >
        {heading}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cards.length >= 4 ? 'repeat(2, 1fr)' : `repeat(${cards.length}, 1fr)`,
          gap: 10,
        }}
      >
        {cards.map((k, i) => (
          <div
            key={i}
            style={{
              padding: '12px 12px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  letterSpacing: -0.3,
                }}
              >
                {k.value}
              </span>
              {k.trend && (
                <span style={{ fontSize: 12, fontWeight: 800, color: TREND_COLOR[k.trend] }}>
                  {TREND_ICON[k.trend]}
                </span>
              )}
            </div>
            {k.hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{k.hint}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
