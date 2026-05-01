// s218: North Star 1화면 — DAU / 신규가입 / 핵심 PV / CTA 클릭 + 어제 대비 변동 + 7d sparkline
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface NorthStarMetrics {
  dau_today: number;
  dau_yesterday: number;
  dau_7d_avg: number;
  signups_today: number;
  signups_yesterday: number;
  signups_7d: number;
  apt_views_today: number;
  blog_views_today: number;
  stock_views_today: number;
  cta_clicks_today: number;
  cta_clicks_yesterday: number;
  cta_clicks_7d: number;
  pv_sparkline_7d: { date: string; pv: number }[];
}

function deltaColor(today: number, yesterday: number): string {
  if (today > yesterday) return '#22c55e';
  if (today < yesterday) return '#ef4444';
  return 'var(--text-tertiary)';
}

function deltaLabel(today: number, yesterday: number): string {
  if (yesterday === 0) return today > 0 ? '+∞%' : '0%';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

function Sparkline({ points }: { points: { date: string; pv: number }[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.pv), 1);
  const W = 120;
  const H = 28;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const path = points.map((p, i) => {
    const x = i * step;
    const y = H - (p.pv / max) * H;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} aria-hidden style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

function MetricCard({
  label, value, delta, sublabel, sparkline,
}: {
  label: string;
  value: string | number;
  delta?: { today: number; yesterday: number };
  sublabel?: string;
  sparkline?: { date: string; pv: number }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        padding: '14px 16px',
        background: 'var(--bg-elevated, #1f2028)',
        border: '1px solid var(--border, #2a2b35)',
        borderRadius: 'var(--radius-md, 10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 92,
        wordBreak: 'keep-all',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #888)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #fff)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 11, color: deltaColor(delta.today, delta.yesterday), fontWeight: 600 }}>
          어제 대비 {deltaLabel(delta.today, delta.yesterday)}
        </div>
      )}
      {sublabel && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #888)' }}>{sublabel}</div>
      )}
      {sparkline && (
        <div style={{ marginTop: 4, color: 'var(--text-secondary, #aaa)' }}>
          <Sparkline points={sparkline} />
        </div>
      )}
    </div>
  );
}

export default async function NorthStarCard() {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('admin_north_star_metrics');
  if (error || !data) {
    return (
      <div style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
        North Star 메트릭 로드 실패
      </div>
    );
  }
  const m = data as NorthStarMetrics;
  const corePvToday = (m.apt_views_today ?? 0) + (m.blog_views_today ?? 0) + (m.stock_views_today ?? 0);

  return (
    <section aria-label="North Star 핵심 지표" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary, #fff)' }}>
        🌟 North Star (오늘)
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10,
        }}
      >
        <MetricCard
          label="DAU (오늘)"
          value={(m.dau_today ?? 0).toLocaleString()}
          delta={{ today: m.dau_today ?? 0, yesterday: m.dau_yesterday ?? 0 }}
          sublabel={`7d 평균 ${(m.dau_7d_avg ?? 0).toLocaleString()}`}
          sparkline={m.pv_sparkline_7d}
        />
        <MetricCard
          label="신규 가입"
          value={(m.signups_today ?? 0).toLocaleString()}
          delta={{ today: m.signups_today ?? 0, yesterday: m.signups_yesterday ?? 0 }}
          sublabel={`7d 합계 ${(m.signups_7d ?? 0).toLocaleString()}`}
        />
        <MetricCard
          label="핵심 PV (apt+blog+stock)"
          value={corePvToday.toLocaleString()}
          sublabel={`apt ${m.apt_views_today ?? 0} · blog ${m.blog_views_today ?? 0} · stock ${m.stock_views_today ?? 0}`}
        />
        <MetricCard
          label="CTA 클릭"
          value={(m.cta_clicks_today ?? 0).toLocaleString()}
          delta={{ today: m.cta_clicks_today ?? 0, yesterday: m.cta_clicks_yesterday ?? 0 }}
          sublabel={`7d 합계 ${(m.cta_clicks_7d ?? 0).toLocaleString()}`}
        />
      </div>
    </section>
  );
}
