'use client';

interface Metric {
  label: string;
  value: string;
  change?: number | null; // positive = green, negative = red
  suffix?: string;
}

interface BlogMetricCardsProps {
  metrics: Metric[];
}

export default function BlogMetricCards({ metrics }: BlogMetricCardsProps) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, 1fr)`,
      gap: 8,
      marginBottom: 20,
    }}>
      {metrics.map((m, i) => (
        <div key={i} style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 500 }}>
            {m.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {m.value}
            {m.suffix && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 2 }}>{m.suffix}</span>}
          </div>
          {m.change !== null && m.change !== undefined && (
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              marginTop: 2,
              color: m.change > 0 ? 'var(--accent-green)' : m.change < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)',
            }}>
              {m.change > 0 ? '▲' : m.change < 0 ? '▼' : '—'} {Math.abs(m.change)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 블로그 데이터에서 메트릭 카드 생성
 */
export function buildAptMetrics(data: any): Metric[] {
  const metrics: Metric[] = [];
  if (data?.avg_sale_price_pyeong) {
    metrics.push({ label: '평당가', value: `${data.avg_sale_price_pyeong.toLocaleString()}만`, change: data.price_change_1y });
  }
  if (data?.jeonse_ratio) {
    metrics.push({ label: '전세가율', value: `${data.jeonse_ratio}%` });
  }
  if (data?.total_households) {
    metrics.push({ label: '세대수', value: `${data.total_households.toLocaleString()}`, suffix: '세대' });
  }
  if (data?.built_year) {
    const age = new Date().getFullYear() - data.built_year;
    metrics.push({ label: '연식', value: `${age}년차` });
  }
  return metrics;
}

export function buildStockMetrics(data: any): Metric[] {
  const metrics: Metric[] = [];
  if (data?.price) {
    metrics.push({ label: '현재가', value: data.price.toLocaleString(), suffix: data.currency === 'USD' ? '$' : '원', change: data.change_pct });
  }
  if (data?.per) {
    metrics.push({ label: 'PER', value: `${data.per}`, suffix: '배' });
  }
  if (data?.market_cap) {
    const cap = data.market_cap >= 10000_0000 ? `${(data.market_cap / 10000_0000).toFixed(1)}조` : `${(data.market_cap / 10000).toFixed(0)}억`;
    metrics.push({ label: '시총', value: cap });
  }
  if (data?.dividend_yield !== null && data?.dividend_yield > 0) {
    metrics.push({ label: '배당률', value: `${data.dividend_yield}%` });
  }
  return metrics;
}
