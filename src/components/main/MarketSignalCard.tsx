// s220 메인 v5: MarketSignalCard — 6개월 평균 분양가 SVG area chart + 4-stripe pulse (server)
import type { MainMarketSignal } from './types';

interface Props {
  signal: MainMarketSignal;
}

function fmtPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function fmtAmt(n: number): string {
  if (!n) return '-';
  return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
}

function buildPath(data: number[]): { line: string; area: string } | null {
  if (!data || data.length < 2) return null;
  const w = 320;
  const h = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * 50 - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}

export default function MarketSignalCard({ signal }: Props) {
  const path = buildPath(signal.avg_price_6m ?? []);
  const nowLabel = new Date().toLocaleString('ko-KR', { hour: 'numeric', minute: '2-digit' });

  const stripes: Array<{ label: string; value: string; pct: number | null }> = [
    {
      label: '주간 거래량',
      value: `${(signal.weekly_volume ?? 0).toLocaleString()}건`,
      pct: signal.weekly_volume_pct ?? 0,
    },
    {
      label: '평균 가격',
      value: fmtAmt(signal.weekly_avg_price ?? 0),
      pct: signal.weekly_avg_price_pct ?? 0,
    },
    {
      label: '전국 청약중',
      value: `${(signal.nationwide_subs ?? 0).toLocaleString()}건`,
      pct: signal.nationwide_subs_pct ?? 0,
    },
    { label: '갱신', value: nowLabel, pct: null },
  ];

  return (
    <section
      style={{
        marginBottom: 20,
        padding: 16,
        borderRadius: 'var(--radius-card)',
        border: '0.5px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.3px',
          }}
        >
          📈 시장 시그널
        </h2>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>최근 6개월 평균 분양가 추이</span>
      </header>

      {path ? (
        <svg
          viewBox="0 0 320 60"
          preserveAspectRatio="none"
          style={{ width: '100%', height: 60, display: 'block' }}
          aria-label="6개월 평균 분양가 추이"
        >
          <defs>
            <linearGradient id="market-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={path.area} fill="url(#market-area-grad)" />
          <path d={path.line} fill="none" stroke="var(--brand)" strokeWidth="1.5" />
        </svg>
      ) : (
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          데이터 부족
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {stripes.map((s) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '8px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-base)',
              border: '0.5px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, fontWeight: 600 }}>
              {s.label}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
                letterSpacing: '-0.2px',
              }}
            >
              {s.value}
            </span>
            {s.pct !== null && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  marginTop: 2,
                  color: s.pct >= 0 ? 'var(--accent-green)' : 'var(--error)',
                }}
              >
                {fmtPct(s.pct)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
