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
  const cols = cards.length > 4 ? 3 : 4;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, marginBottom: 14 }}>
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
            position: 'relative',
          }}
          onMouseEnter={e => { if (s.scrollTo) e.currentTarget.style.borderColor = s.barColor; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {s.scrollTo && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke={s.barColor || 'var(--text-tertiary)'} strokeWidth="2"><path d="M6 2v8M3 7l3 3 3-3"/></svg>
            </span>
          )}
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
