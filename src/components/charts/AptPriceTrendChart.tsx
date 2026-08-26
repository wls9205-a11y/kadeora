'use client';
import { useState, useEffect } from 'react';
import { SkeletonChart } from '@/components/Skeleton';

interface TrendPoint { deal_date: string; price: number; area: number; price_per_pyeong: number; }
interface Stats { count: number; max: number; min: number; avg: number; latest: number; }

function fmtPrice(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

/* ⚠️ `region` 과 `sigungu` 를 «둘 다» 넘긴다.
 *    RPC 는 이제 이름을 «정확일치» 로 본다(옛 `ILIKE '%…%'` 는 부산 「현대」 차트 하나에
 *    서로 다른 단지 59곳·13개 시군구·2,311건을 합쳐 넣고 있었다).
 *    그래도 같은 «정확한» 이름이 여러 시도·시군구에 있다 — `현대` 는 최근 1년 부산에만
 *    9개 시군구 180건이다. 지역 둘을 다 줘야 한 단지가 된다.
 *    실측: sigungu 를 더해도 매칭이 줄지 않는다(부울경 기축 631곳 → 631곳). */
export default function AptPriceTrendChart({ aptName, region, sigungu, prefix }: { aptName: string; region?: string; sigungu?: string | null; prefix?: boolean }) {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'price' | 'pyeong'>('price');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ name: aptName });
    if (region) params.set('region', region);
    if (sigungu) params.set('sigungu', sigungu);
    // ⚠️ DB 의 `apt_sites.tx_match_prefix` 를 그대로 전달한다. 여기서 지어내지 않는다 —
    //    전역 접두 매칭은 부산 「현대」를 59개 단지로 다시 뭉치게 한다.
    if (prefix) params.set('prefix', '1');
    fetch(`/api/apt/price-trend?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.trend) {
          setTrend(d.trend);
          setStats(d.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [aptName, region, sigungu, prefix]);

  if (loading) return <SkeletonChart height={180} />;
  if (!trend.length) return null;

  // 차트 데이터 (시간순 정렬)
  const sorted = [...trend].reverse();
  const values = sorted.map(t => mode === 'price' ? t.price : t.price_per_pyeong);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  // SVG 차트
  const W = 600, H = 160, PAD = 30;
  const chartW = W - PAD * 2;
  const chartH = H - PAD * 2;

  const points = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * chartW;
    const y = PAD + chartH - ((v - minVal) / range) * chartH;
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1]?.x},${PAD + chartH} L${points[0]?.x},${PAD + chartH} Z`;

  const hovered = hoverIdx !== null ? sorted[hoverIdx] : null;

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)', padding: 14, marginBottom: 'var(--sp-md)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>실거래가 추이</div>
          {stats && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {stats.count}건 · 최고 {fmtPrice(stats.max)} · 최저 {fmtPrice(stats.min)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
          {(['price', 'pyeong'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
              fontSize: 'var(--fs-xs)', fontWeight: 600,
              background: mode === m ? 'var(--brand)' : 'var(--bg-hover)',
              color: mode === m ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}>
              {m === 'price' ? '거래가' : '평당가'}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 바 */}
      {stats && (
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 10 }}>
          {[
            { label: '최근', value: fmtPrice(stats.latest), color: 'var(--accent-blue)' },
            { label: '평균', value: fmtPrice(stats.avg), color: 'var(--text-secondary)' },
            { label: '최고', value: fmtPrice(stats.max), color: 'var(--accent-red)' },
            { label: '최저', value: fmtPrice(stats.min), color: 'var(--accent-green)' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: '6px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.label}</div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* SVG 차트 */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchEnd={() => setHoverIdx(null)}>
        {/* 그리드 */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = PAD + chartH * (1 - pct);
          const val = minVal + range * pct;
          return (
            <g key={pct}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={PAD - 4} y={y + 3} textAnchor="end" fill="var(--text-tertiary)" fontSize={9}>
                {fmtPrice(Math.round(val))}
              </text>
            </g>
          );
        })}

        {/* 영역 + 라인 */}
        <path d={areaPath} fill="url(#trendGrad)" opacity={0.3} />
        <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth={2} />
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* 호버 영역 */}
        {points.map((p, i) => (
          <rect key={i} x={p.x - chartW / values.length / 2} y={PAD} width={chartW / values.length} height={chartH}
            fill="transparent" onMouseEnter={() => setHoverIdx(i)} onTouchStart={() => setHoverIdx(i)} />
        ))}

        {/* 호버 포인트 */}
        {hoverIdx !== null && points[hoverIdx] && (
          <>
            <line x1={points[hoverIdx].x} y1={PAD} x2={points[hoverIdx].x} y2={PAD + chartH}
              stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={points[hoverIdx].x} cy={points[hoverIdx].y} r={4} fill="var(--brand)" stroke="#fff" strokeWidth={2} />
          </>
        )}

        {/* X축 날짜 (간격 조절) */}
        {sorted.filter((_, i) => i % Math.max(1, Math.floor(sorted.length / 5)) === 0).map((t, idx) => {
          const origIdx = sorted.indexOf(t);
          const x = PAD + (origIdx / Math.max(sorted.length - 1, 1)) * chartW;
          return (
            <text key={idx} x={x} y={H - 4} textAnchor="middle" fill="var(--text-tertiary)" fontSize={9}>
              {t.deal_date?.slice(2, 7)}
            </text>
          );
        })}
      </svg>

      {/* 호버 툴팁 */}
      {hovered && (
        <div style={{
          fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textAlign: 'center',
          padding: '6px 0', borderTop: '1px solid var(--border)', marginTop: 'var(--sp-xs)',
        }}>
          {hovered.deal_date} · {fmtPrice(hovered.price)} · {hovered.area}㎡ · 평당 {fmtPrice(hovered.price_per_pyeong)}
        </div>
      )}
    </div>
  );
}
