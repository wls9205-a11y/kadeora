'use client';

interface KpiCard {
  l: string;
  v: string;
  sub: string;
  c: string;
  icon: string;
  bar: number;
  barColor: string;
  scrollTo: string | null;
}

export default function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="kd-grid-4" style={{ gap: 6, marginBottom: 14 }}>
      {cards.map(s => (
        <div
          key={s.l}
          onClick={() => {
            if (s.scrollTo) {
              document.getElementById(s.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 8px',
            textAlign: 'center',
            cursor: s.scrollTo ? 'pointer' : 'default',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { if (s.scrollTo) e.currentTarget.style.borderColor = s.barColor; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.l}</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: s.c, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{s.v}</div>
          {s.sub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3, whiteSpace: 'pre-line' }}>{s.sub}</div>}
          {s.bar > 0 && (
            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 'var(--sp-xs)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.bar}%`, borderRadius: 2, background: s.barColor }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
