/**
 * [BIG-EVENT-CHARTS] — Recharts 대안으로 SVG 기반 3종 차트
 *
 * 의존성 없이 서버 렌더 가능 (기존 프로젝트 패턴 유지).
 * blog/[slug] 페이지에서 big_event_registry 매칭 시 자동 렌더.
 *
 * Props: { eventId: number }
 * - 차트 1: 평형별 2025년 median 가격 bar
 * - 차트 2: 연도별(2023~2025) 평균가 line
 * - 차트 3: Stage 7단계 타임라인 (현재 Stage 하이라이트)
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Props {
  eventId: number;
}

const STAGE_LABEL: Record<number, string> = {
  1: '논의',
  2: '조합설립',
  3: '사업시행',
  4: '관리처분',
  5: '철거·착공',
  6: '일반분양',
  7: '입주·준공',
};

function fmt억(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

export default async function BigEventCharts({ eventId }: Props) {
  try {
    const sb = getSupabaseAdmin();
    const { data: ev } = await (sb as any)
      .from('big_event_registry')
      .select('id, name, stage, scale_before, scale_after, new_brand_name, apt_complex_profile_id')
      .eq('id', eventId)
      .maybeSingle();
    if (!ev) return null;

    // 해당 단지 실거래 조회 (apt_name 매칭)
    const { data: trades } = await sb
      .from('apt_transactions')
      .select('deal_date, deal_amount, exclusive_area')
      .eq('apt_name', ev.name)
      .gte('deal_date', '2023-01-01')
      .order('deal_date', { ascending: true })
      .limit(500);

    const rows: { date: string; price: number; area: number }[] = (trades || [])
      .filter((t: any) => Number(t.deal_amount) > 0 && Number(t.exclusive_area) > 0)
      .map((t: any) => ({ date: String(t.deal_date), price: Number(t.deal_amount), area: Number(t.exclusive_area) }));

    // 차트 1: 평형별 median 가격 (2025년)
    const areaGroups = new Map<string, number[]>();
    for (const r of rows) {
      if (!r.date.startsWith('2025')) continue;
      const key = `${Math.round(r.area)}㎡`;
      const arr = areaGroups.get(key) || [];
      arr.push(r.price);
      areaGroups.set(key, arr);
    }
    const areaBars = [...areaGroups.entries()]
      .map(([k, v]) => {
        const sorted = [...v].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        return { label: k, median, count: v.length };
      })
      .sort((a, b) => parseInt(a.label) - parseInt(b.label))
      .slice(0, 8);

    // 차트 2: 연도별(2023~2025) 평균가
    const yearMap = new Map<string, number[]>();
    for (const r of rows) {
      const y = r.date.slice(0, 4);
      if (!/^(2023|2024|2025)$/.test(y)) continue;
      const arr = yearMap.get(y) || [];
      arr.push(r.price);
      yearMap.set(y, arr);
    }
    const yearPoints = ['2023', '2024', '2025']
      .map((y) => {
        const arr = yearMap.get(y) || [];
        if (arr.length === 0) return null;
        const avg = Math.round(arr.reduce((s, a) => s + a, 0) / arr.length);
        return { year: y, avg, count: arr.length };
      })
      .filter(Boolean) as { year: string; avg: number; count: number }[];

    // 스타일 상수
    const CARD: React.CSSProperties = {
      marginTop: 24,
      padding: '14px 16px',
      borderRadius: 'var(--radius-card, 12px)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
    };
    const TITLE: React.CSSProperties = {
      fontSize: 14,
      fontWeight: 800,
      color: 'var(--text-primary)',
      margin: '0 0 10px',
    };

    // --- 차트 1 렌더 ---
    const barMax = Math.max(1, ...areaBars.map((b) => b.median));
    const chart1 = areaBars.length > 0 ? (
      <section style={CARD} aria-label={`${ev.name} 평형별 median 시세`}>
        <h3 style={TITLE}>📊 {ev.name} 평형별 시세 (2025 median, {areaBars.reduce((s, a) => s + a.count, 0)}건)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          {areaBars.map((b) => {
            const w = Math.max(6, Math.round((b.median / barMax) * 100));
            return (
              <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{b.label} · {b.count}건</span>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg,#3b7bf6,#2563eb)' }} />
                </div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{fmt억(b.median)}</span>
              </div>
            );
          })}
        </div>
      </section>
    ) : null;

    // --- 차트 2 렌더 ---
    const ymMax = Math.max(1, ...yearPoints.map((y) => y.avg));
    const ymMin = Math.min(...yearPoints.map((y) => y.avg));
    const chart2 = yearPoints.length >= 2 ? (
      <section style={CARD} aria-label={`${ev.name} 연도별 평균가`}>
        <h3 style={TITLE}>📈 {ev.name} 연도별 평균가 (2023~2025)</h3>
        <svg viewBox="0 0 320 120" role="img" aria-label="연도별 가격 라인" style={{ width: '100%', maxWidth: 560, height: 140 }}>
          {yearPoints.map((p, i) => {
            const x = 40 + i * ((240) / Math.max(1, yearPoints.length - 1));
            const y = 100 - ((p.avg - ymMin) / Math.max(1, ymMax - ymMin)) * 80;
            const next = yearPoints[i + 1];
            const nx = next ? 40 + (i + 1) * ((240) / Math.max(1, yearPoints.length - 1)) : null;
            const ny = next ? 100 - ((next.avg - ymMin) / Math.max(1, ymMax - ymMin)) * 80 : null;
            return (
              <g key={p.year}>
                {nx !== null && ny !== null && (
                  <line x1={x} y1={y} x2={nx} y2={ny} stroke="#3b7bf6" strokeWidth="2" />
                )}
                <circle cx={x} cy={y} r={4} fill="#3b7bf6" />
                <text x={x} y={y - 8} fontSize="10" fill="currentColor" textAnchor="middle">{fmt억(p.avg)}</text>
                <text x={x} y={118} fontSize="10" fill="var(--text-tertiary)" textAnchor="middle">{p.year} · {p.count}건</text>
              </g>
            );
          })}
        </svg>
      </section>
    ) : null;

    // --- 차트 3: Stage 타임라인 ---
    const currentStage = Number(ev.stage || 1);
    const chart3 = (
      <section style={CARD} aria-label={`${ev.name} Stage 타임라인`}>
        <h3 style={TITLE}>🏗️ {ev.name} 재건축 진행 Stage (현재 {currentStage}/7)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((s) => {
            const active = s === currentStage;
            const past = s < currentStage;
            const bg = active
              ? 'linear-gradient(135deg,#3b7bf6,#2563eb)'
              : past
                ? 'var(--brand-bg, rgba(59,123,246,0.18))'
                : 'var(--bg-hover)';
            const fg = active ? '#fff' : past ? 'var(--brand)' : 'var(--text-tertiary)';
            return (
              <div
                key={s}
                style={{
                  padding: '10px 6px',
                  borderRadius: 8,
                  background: bg,
                  color: fg,
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: active ? 800 : 600,
                  border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
                }}
                aria-current={active ? 'step' : undefined}
              >
                <div style={{ fontSize: 10, opacity: 0.8 }}>Stage {s}</div>
                <div>{STAGE_LABEL[s]}</div>
              </div>
            );
          })}
        </div>
        {ev.new_brand_name ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            예상 브랜드: <strong style={{ color: 'var(--text-primary)' }}>{ev.new_brand_name}</strong>
          </div>
        ) : null}
      </section>
    );

    if (!chart1 && !chart2) {
      // 데이터가 부족해도 Stage 차트는 항상 렌더
      return <div>{chart3}</div>;
    }
    return (
      <div>
        {chart1}
        {chart2}
        {chart3}
      </div>
    );
  } catch {
    return null;
  }
}
