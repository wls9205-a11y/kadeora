'use client';

// /admin 메인에 박히는 가입 funnel 진단 요약 위젯.
// RPC admin_dashboard_signup_widget() 결과를 4 패널로:
//   A) 오늘 KPI 4 tile + 어제 대비 delta_pct
//   B) 24h funnel 5단계 미니 막대
//   C) 8h sparkline (visitors line + signups dot)
//   D) 최근 가입 5명 list
// 상단 우측: health 배지 (click_status / signup_status) + "📊 상세 진단" 링크.
// 30s 자동 폴링 + visibilitychange 가드 (s185 패턴).

import { useCallback, useEffect, useState } from 'react';

interface DayBucket { visitors?: number | null; cta_clicks?: number | null; attempts?: number | null; signups?: number | null; }
interface DeltaPct { visitors?: number | null; cta_clicks?: number | null; signups?: number | null; }
interface Funnel24h {
  cta_views?: number | null; cta_clicks?: number | null; attempts?: number | null;
  oauth_callback?: number | null; success?: number | null; signups_real?: number | null;
  click_to_attempt_pct?: number | null; attempt_to_signup_pct?: number | null;
}
interface SparkRow { h?: string; visitors?: number | null; clicks?: number | null; attempts?: number | null; signups?: number | null; }
interface RecentSignup { email_masked?: string | null; created_at?: string | null; provider?: string | null; source?: string | null; }
type HealthStatus = 'OK' | 'WARN' | 'CRITICAL' | 'INSUFFICIENT_DATA' | string;
interface Health {
  clicks_1h?: number | null; clicks_baseline_1h?: number | null;
  click_status?: HealthStatus; signup_status?: HealthStatus;
}
interface WidgetData {
  generated_at?: string;
  today_kst?: DayBucket;
  yesterday_kst?: DayBucket;
  delta_pct?: DeltaPct;
  funnel_24h?: Funnel24h;
  sparkline_8h?: SparkRow[];
  recent_signups?: RecentSignup[];
  health?: Health;
}

const REFRESH_MS = 30_000;

function n(v: any): number { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function fmtNum(v: any): string { return n(v).toLocaleString(); }
function fmtPct(v: any): string {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return `${x >= 0 ? '+' : ''}${x.toFixed(0)}%`;
}
function deltaColor(v: any): string {
  const x = Number(v);
  if (!Number.isFinite(x) || x === 0) return 'var(--text-tertiary, #9ca3af)';
  return x > 0 ? '#34d399' : '#f87171';
}
function healthBadge(s: HealthStatus | undefined): { bg: string; fg: string; label: string } {
  switch (s) {
    case 'OK':       return { bg: 'rgba(52,211,153,0.14)',  fg: '#34d399', label: 'OK' };
    case 'WARN':     return { bg: 'rgba(251,191,36,0.16)',  fg: '#fbbf24', label: 'WARN' };
    case 'CRITICAL': return { bg: 'rgba(248,113,113,0.16)', fg: '#f87171', label: 'CRITICAL' };
    default:         return { bg: 'rgba(156,163,175,0.18)', fg: '#9ca3af', label: '데이터 부족' };
  }
}
function fmtKstHm(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso.slice(11, 16) || '—'; }
}

export default function SignupFunnelWidget() {
  const [data, setData] = useState<WidgetData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/admin/dashboard-widget', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json();
        if (j?.ok && j?.data) {
          setData(j.data as WidgetData);
          setErr(null);
        } else {
          setErr(j?.error || 'no data');
        }
        setLastFetch(Date.now());
      })
      .catch((e) => setErr(e?.message ?? 'fetch failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchData]);

  const today = data?.today_kst ?? {};
  const delta = data?.delta_pct ?? {};
  const funnel = data?.funnel_24h ?? {};
  const spark = data?.sparkline_8h ?? [];
  const recent = data?.recent_signups ?? [];
  const health = data?.health ?? {};

  return (
    <section
      aria-label="가입 진단 위젯"
      style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
          🎯 가입 진단
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
          오늘 vs 어제 · 24h funnel · 8h trend · 최근 가입
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {(() => {
            const c = healthBadge(health.click_status);
            return (
              <span style={{ ...badgeStyle(c.bg), color: c.fg }} title={`click_status (1h ${fmtNum(health.clicks_1h)} / baseline ${fmtNum(health.clicks_baseline_1h)})`}>
                클릭 {c.label}
              </span>
            );
          })()}
          {(() => {
            const c = healthBadge(health.signup_status);
            return <span style={{ ...badgeStyle(c.bg), color: c.fg }}>가입 {c.label}</span>;
          })()}
          <a
            href="/admin/signup-flow"
            style={{
              fontSize: 11, fontWeight: 700,
              padding: '6px 12px', borderRadius: 6,
              background: 'transparent', color: 'var(--text-secondary, #ccc)',
              border: '1px solid var(--border, #2a2b35)', textDecoration: 'none',
            }}
          >📊 상세 진단</a>
          <button
            onClick={fetchData}
            style={{
              fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 6,
              background: 'transparent', color: 'var(--text-secondary, #ccc)',
              border: '1px solid var(--border, #2a2b35)', cursor: 'pointer',
            }}
          >↻</button>
        </div>
      </header>

      {loading && !data && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary, #888)', fontSize: 12 }}>로드 중…</div>
      )}
      {err && !loading && (
        <div style={{ padding: 10, fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8 }}>
          위젯 데이터 가져오기 실패: {err}
        </div>
      )}

      {data && (
        <>
          {/* A) 오늘 KPI 4 tile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <KpiTile label="방문"    value={today.visitors}    delta={delta.visitors} />
            <KpiTile label="CTA 클릭" value={today.cta_clicks}  delta={delta.cta_clicks} />
            <KpiTile label="시도"    value={today.attempts}    delta={null} />
            <KpiTile label="가입"    value={today.signups}     delta={delta.signups} highlight />
          </div>

          {/* B) 24h funnel 미니 막대 */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>24H FUNNEL</div>
            <FunnelMini funnel={funnel} />
          </div>

          {/* C+D 두 칼럼 — 8h sparkline + 최근 가입 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>
                8H TREND <span style={{ marginLeft: 6, color: '#60a5fa', fontWeight: 700 }}>● 방문</span>
                <span style={{ marginLeft: 6, color: '#34d399', fontWeight: 700 }}>● 가입</span>
              </div>
              <Sparkline rows={spark} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>최근 가입 (5)</div>
              <RecentList rows={recent} />
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', textAlign: 'right' }}>
            generated_at {data.generated_at ? new Date(data.generated_at).toLocaleTimeString('ko-KR') : '—'}
            {lastFetch && <> · 갱신 {new Date(lastFetch).toLocaleTimeString('ko-KR')} · 30s 자동</>}
          </div>
        </>
      )}
    </section>
  );
}

// ─── 하위 컴포넌트 ─────────────────────────────────────

function KpiTile({ label, value, delta, highlight }: { label: string; value: number | null | undefined; delta: number | null | undefined; highlight?: boolean }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: highlight ? 'rgba(52,211,153,0.06)' : 'var(--bg-base, #0d0e14)',
      border: '1px solid var(--border, #2a2b35)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <span style={{
          fontSize: 22, fontWeight: 900, letterSpacing: -0.5,
          color: highlight ? '#34d399' : 'var(--text-primary, #fff)',
        }}>{fmtNum(value)}</span>
        {delta != null && (
          <span style={{ fontSize: 10, fontWeight: 800, color: deltaColor(delta) }}>
            {fmtPct(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

function FunnelMini({ funnel }: { funnel: Funnel24h }) {
  const stages = [
    { key: 'cta_views',      label: '노출',     v: n(funnel.cta_views) },
    { key: 'cta_clicks',     label: '클릭',     v: n(funnel.cta_clicks) },
    { key: 'attempts',       label: '시도',     v: n(funnel.attempts) },
    { key: 'oauth_callback', label: '콜백',     v: n(funnel.oauth_callback) },
    { key: 'success',        label: '성공',     v: n(funnel.success ?? funnel.signups_real) },
  ];
  const max = Math.max(1, ...stages.map((s) => s.v));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stages.map((s, i) => {
        const w = (s.v / max) * 100;
        const prev = i > 0 ? stages[i - 1].v : 0;
        const passRate = prev > 0 ? (s.v / prev) * 100 : null;
        const passColor = passRate == null ? 'var(--text-tertiary)'
          : passRate >= 70 ? '#34d399'
          : passRate >= 30 ? '#fbbf24'
          : '#f87171';
        return (
          <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 56px 70px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary, #ccc)' }}>{s.label}</span>
            <div style={{ height: 14, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, textAlign: 'right' }}>{fmtNum(s.v)}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: passColor, textAlign: 'right' }}>
              {passRate == null ? '—' : `통과 ${passRate.toFixed(0)}%`}
            </span>
          </div>
        );
      })}
      {/* 보조 KPI: 클릭→시도, 시도→가입 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: 'var(--text-tertiary, #888)' }}>
        <span>클릭→시도 <strong style={{ color: 'var(--text-secondary, #ccc)', marginLeft: 2 }}>{Number(funnel.click_to_attempt_pct ?? 0).toFixed(1)}%</strong></span>
        <span>시도→가입 <strong style={{ color: 'var(--text-secondary, #ccc)', marginLeft: 2 }}>{Number(funnel.attempt_to_signup_pct ?? 0).toFixed(1)}%</strong></span>
      </div>
    </div>
  );
}

function Sparkline({ rows }: { rows: SparkRow[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary, #888)', fontSize: 11 }}>데이터 없음</div>;
  }
  const sorted = [...rows].sort((a, b) => String(a.h ?? '').localeCompare(String(b.h ?? '')));
  const W = 320, H = 64, PADX = 6, PADY = 6;
  const visits = sorted.map((r) => n(r.visitors));
  const signups = sorted.map((r) => n(r.signups));
  const max = Math.max(1, ...visits);
  const xAt = (i: number) => sorted.length > 1 ? PADX + (i / (sorted.length - 1)) * (W - 2 * PADX) : W / 2;
  const yAt = (v: number) => H - PADY - (v / max) * (H - 2 * PADY);
  const linePath = sorted.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(visits[i]).toFixed(1)}`).join(' ');
  const areaPath = sorted.length > 1 ? `${linePath} L ${xAt(sorted.length - 1).toFixed(1)} ${H - PADY} L ${xAt(0).toFixed(1)} ${H - PADY} Z` : '';

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        <path d={areaPath} fill="rgba(96,165,250,0.10)" stroke="none" />
        <path d={linePath} stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {/* signup dots */}
        {sorted.map((_, i) => signups[i] > 0 ? (
          <circle key={i} cx={xAt(i)} cy={yAt(signups[i])} r={3} fill="#34d399" />
        ) : null)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary, #888)', marginTop: 2 }}>
        {sorted.length > 0 && <span>{sorted[0].h ?? ''}h</span>}
        <span>최대 방문 {fmtNum(max)}</span>
        {sorted.length > 0 && <span>{sorted[sorted.length - 1].h ?? ''}h</span>}
      </div>
    </div>
  );
}

function RecentList({ rows }: { rows: RecentSignup[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary, #888)', fontSize: 11 }}>최근 가입 없음</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.slice(0, 5).map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center',
          padding: '6px 10px', borderRadius: 6,
          background: 'var(--bg-base, #0d0e14)', border: '1px solid var(--border, #2a2b35)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.email_masked || '—'}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary, #ccc)', padding: '1px 6px', borderRadius: 3, background: 'var(--bg-elevated, #1f2028)' }}>
            {r.source || r.provider || '—'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', whiteSpace: 'nowrap' }}>
            {fmtKstHm(r.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function badgeStyle(bg: string): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 800,
    padding: '4px 10px', borderRadius: 999,
    background: bg, letterSpacing: 0.3,
  };
}
