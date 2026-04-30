'use client';

// /admin 메인에 박히는 관심 등록 (watchlist + 분양현장 leadgen) 위젯.
// RPC admin_dashboard_watchlist_widget() 결과 4 패널:
//   A) 누적 KPI 5 tile (총 / organic / 자동 / 단지 / 종목) + 어제 대비 delta_pct
//   B) 14일 daily bar chart (total 회색 + organic 녹색 오버레이)
//   C) 인기 단지/종목 TOP — 좌우 컬럼
//   D) 최근 자연 등록 10건 list
// 헤더 우측: 분양현장 leadgen chip + health 시그널 (organic_today vs delta_pct)
// 30s 자동 폴링 + visibilitychange 가드 (s211 패턴 동일).

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Bucket {
  total?: number | null;
  organic?: number | null;
  apt?: number | null;
  stock?: number | null;
  unique_users?: number | null;
}
interface DeltaPct {
  total?: number | null;
  organic?: number | null;
  apt?: number | null;
  stock?: number | null;
}
interface DailyRow {
  date?: string;
  apt?: number | null;
  stock?: number | null;
  total?: number | null;
  organic?: number | null;
}
interface TopRow {
  name?: string | null;
  item_id?: string | null;
  users?: number | null;
  organic_users?: number | null;
  last_added?: string | null;
}
interface RecentRow {
  item_name?: string | null;
  item_type?: string | null;        // 'apt' | 'stock'
  item_id?: string | null;
  created_at?: string | null;
  is_organic?: boolean | null;
  user_email_masked?: string | null;
  user_nickname?: string | null;
}
interface WatchlistData {
  total?: number | null;
  organic_total?: number | null;
  auto_total?: number | null;
  apt_total?: number | null;
  stock_total?: number | null;
  organic_apt?: number | null;
  organic_stock?: number | null;
  unique_users?: number | null;
  organic_users?: number | null;
  today?: Bucket;
  yesterday?: Bucket;
  delta_pct?: DeltaPct;
  organic_delta_pct?: DeltaPct;
  avg_per_user?: number | null;
  organic_avg_per_user?: number | null;
  daily_14d?: DailyRow[];
  top_apt?: TopRow[];
  top_stock?: TopRow[];
  recent_added?: RecentRow[];
}
interface SiteRow {
  site_id?: string | null;
  site_name?: string | null;
  total?: number | null;
  members?: number | null;
  guests?: number | null;
  last_added?: string | null;
}
interface SiteInterestData {
  total?: number | null;
  members?: number | null;
  guests?: number | null;
  notif_enabled?: number | null;
  last_24h?: number | null;
  last_7d?: number | null;
  distinct_sites?: number | null;
  top_sites?: SiteRow[];
}
interface RpcResponse {
  generated_at?: string;
  watchlist?: WatchlistData;
  site_interest?: SiteInterestData;
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
function fmtKstHm(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso.slice(11, 16) || '—'; }
}
function fmtKstDateHm(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso.slice(5, 16); }
}

export default function WatchlistWidget() {
  const [data, setData] = useState<RpcResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/admin/watchlist-widget', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json();
        if (j?.ok && j?.data) {
          setData(j.data as RpcResponse);
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

  const wl = data?.watchlist ?? {};
  const si = data?.site_interest ?? {};
  const today = wl.today ?? {};
  const delta = wl.delta_pct ?? {};
  const orgDelta = wl.organic_delta_pct ?? {};
  const daily = wl.daily_14d ?? [];
  const topApt = wl.top_apt ?? [];
  const topStock = wl.top_stock ?? [];
  const recent = wl.recent_added ?? [];

  // health 시그널: organic 오늘 0건이면 amber, 어제 대비 organic delta 음수면 red
  const healthBadge = useMemo<{ bg: string; fg: string; label: string }>(() => {
    const orgToday = n(today.organic);
    const orgD = Number(orgDelta?.organic);
    if (orgToday === 0) return { bg: 'rgba(251,191,36,0.16)', fg: '#fbbf24', label: '오늘 자연 등록 0' };
    if (Number.isFinite(orgD) && orgD < -30) return { bg: 'rgba(248,113,113,0.16)', fg: '#f87171', label: `자연 등록 ${orgD.toFixed(0)}%` };
    if (Number.isFinite(orgD) && orgD < 0) return { bg: 'rgba(251,191,36,0.16)', fg: '#fbbf24', label: `자연 등록 ${orgD.toFixed(0)}%` };
    return { bg: 'rgba(52,211,153,0.14)', fg: '#34d399', label: 'OK' };
  }, [today.organic, orgDelta?.organic]);

  return (
    <section
      aria-label="관심 등록 위젯"
      style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
          🏠 관심 등록 현황
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
          watchlist (apt+stock) + 분양현장 leadgen · 자연/자동 분리
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...badgeStyle(healthBadge.bg), color: healthBadge.fg }}>
            {healthBadge.label}
          </span>
          <button
            type="button"
            onClick={() => setSiteOpen((v) => !v)}
            aria-expanded={siteOpen}
            title="분양현장 leadgen 패널 toggle"
            style={{
              fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 6,
              background: siteOpen ? 'rgba(96,165,250,0.16)' : 'transparent',
              color: siteOpen ? '#60a5fa' : 'var(--text-secondary, #ccc)',
              border: '1px solid var(--border, #2a2b35)', cursor: 'pointer',
            }}
          >
            🏢 분양현장 {fmtNum(si.total)} ({fmtNum(si.last_24h)})
          </button>
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
          {/* A) 누적 KPI 5 tile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <KpiTile
              label="총 등록"
              value={wl.total}
              delta={delta.total}
              sub={`organic ${fmtNum(wl.organic_total)} · 자동 ${fmtNum(wl.auto_total)}`}
            />
            <KpiTile
              label="자연 등록"
              value={wl.organic_total}
              delta={orgDelta.organic ?? orgDelta.total}
              highlight
              sub={`오늘 ${fmtNum(today.organic)} / 어제 ${fmtNum(wl.yesterday?.organic)}`}
            />
            <KpiTile
              label="자동 등록"
              value={wl.auto_total}
              delta={null}
              sub="가입 시 디폴트 추가"
              muted
            />
            <KpiTile
              label="단지 (apt)"
              value={wl.apt_total}
              delta={delta.apt}
              sub={`organic ${fmtNum(wl.organic_apt)}`}
            />
            <KpiTile
              label="종목 (stock)"
              value={wl.stock_total}
              delta={delta.stock}
              sub={`organic ${fmtNum(wl.organic_stock)}`}
            />
          </div>

          {/* 분양현장 패널 (toggle) */}
          {siteOpen && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>
                🏢 분양현장 LEADGEN — 회원 {fmtNum(si.members)} · 게스트 {fmtNum(si.guests)} · 알림 ON {fmtNum(si.notif_enabled)} · 단지 {fmtNum(si.distinct_sites)}
              </div>
              <SiteList rows={si.top_sites ?? []} />
            </div>
          )}

          {/* B) 14일 막대 (total 회색 + organic 녹색 오버레이) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>
              14D DAILY <span style={{ marginLeft: 6, color: 'var(--text-tertiary, #9ca3af)', fontWeight: 700 }}>■ total</span>
              <span style={{ marginLeft: 4, color: '#34d399', fontWeight: 700 }}>■ organic</span>
            </div>
            <DailyBars rows={daily} />
          </div>

          {/* C) 인기 TOP (단지 / 종목) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <TopColumn title="🏠 단지 TOP" rows={topApt} emptyMsg="단지 등록 없음" />
            <TopColumn title="📈 종목 TOP" rows={topStock} emptyMsg="종목 등록 없음" />
          </div>

          {/* D) 최근 자연 등록 */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>
              최근 자연 등록 (10)
            </div>
            <RecentList rows={recent} />
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', textAlign: 'right' }}>
            avg/user {Number(wl.avg_per_user ?? 0).toFixed(2)} · organic avg/user {Number(wl.organic_avg_per_user ?? 0).toFixed(2)} ·
            {' '}generated {data.generated_at ? new Date(data.generated_at).toLocaleTimeString('ko-KR') : '—'}
            {lastFetch && <> · 갱신 {new Date(lastFetch).toLocaleTimeString('ko-KR')} · 30s 자동</>}
          </div>
        </>
      )}
    </section>
  );
}

// ─── 하위 컴포넌트 ─────────────────────────────────────

function KpiTile({ label, value, delta, sub, highlight, muted }: { label: string; value: any; delta: any; sub?: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: highlight ? 'rgba(52,211,153,0.06)' : 'var(--bg-base, #0d0e14)',
      border: '1px solid var(--border, #2a2b35)',
      opacity: muted ? 0.75 : 1,
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
      {sub && (
        <div style={{ fontSize: 9, color: 'var(--text-tertiary, #9ca3af)', marginTop: 3, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function DailyBars({ rows }: { rows: DailyRow[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary, #888)', fontSize: 11 }}>14일 데이터 없음</div>;
  }
  // 날짜 ascending
  const sorted = [...rows].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  const W = 720, H = 88, PADX = 12, PADY = 8;
  const totals = sorted.map((r) => n(r.total));
  const max = Math.max(1, ...totals);
  const colW = sorted.length > 0 ? (W - 2 * PADX) / sorted.length : 0;
  const barW = Math.max(2, colW * 0.7);

  const yAt = (v: number) => H - PADY - (v / max) * (H - 2 * PADY);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', minWidth: 320 }}>
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const y = H - PADY - p * (H - 2 * PADY);
          return <line key={p} x1={PADX} x2={W - PADX} y1={y} y2={y} stroke="var(--border, #2a2b35)" strokeDasharray="2 4" strokeWidth={1} />;
        })}
        {sorted.map((r, i) => {
          const total = n(r.total);
          const organic = n(r.organic);
          const x = PADX + i * colW + (colW - barW) / 2;
          const yT = yAt(total);
          const yO = yAt(organic);
          return (
            <g key={r.date ?? i}>
              {/* total 회색 — 자동 등록 spike (4/17 233) 도 동일 스케일에 들어감 */}
              <rect x={x} y={yT} width={barW} height={Math.max(0, H - PADY - yT)}
                fill="rgba(156,163,175,0.50)" />
              {/* organic 녹색 오버레이 */}
              {organic > 0 && (
                <rect x={x} y={yO} width={barW} height={Math.max(0, H - PADY - yO)}
                  fill="#34d399" opacity={0.92} />
              )}
            </g>
          );
        })}
        {/* date labels — 첫/중/끝만 */}
        {sorted.length > 0 && (
          <>
            <text x={PADX} y={H - 1} fontSize={9} fill="var(--text-tertiary, #888)">{(sorted[0].date ?? '').slice(5)}</text>
            {sorted.length > 1 && (
              <text x={W - PADX} y={H - 1} fontSize={9} textAnchor="end" fill="var(--text-tertiary, #888)">
                {(sorted[sorted.length - 1].date ?? '').slice(5)}
              </text>
            )}
          </>
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary, #888)', marginTop: 2 }}>
        <span>{sorted.length}일</span>
        <span>최대 total {fmtNum(max)}</span>
      </div>
    </div>
  );
}

function TopColumn({ title, rows, emptyMsg }: { title: string; rows: TopRow[]; emptyMsg: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      {!rows || rows.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: 'var(--text-tertiary, #888)', textAlign: 'center', background: 'var(--bg-base, #0d0e14)', borderRadius: 6, border: '1px solid var(--border, #2a2b35)' }}>{emptyMsg}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.slice(0, 10).map((r, i) => {
            const users = n(r.users);
            const organicUsers = n(r.organic_users);
            const showSplit = users !== organicUsers;
            return (
              <div key={(r.item_id ?? r.name ?? '') + i} style={{
                display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 8, alignItems: 'center',
                padding: '6px 10px', borderRadius: 6,
                background: 'var(--bg-base, #0d0e14)', border: '1px solid var(--border, #2a2b35)',
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: i < 3 ? 'var(--brand, #2563EB)' : 'var(--text-tertiary, #888)', textAlign: 'right' }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {r.name ?? '—'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary, #ccc)', whiteSpace: 'nowrap' }}>
                  {showSplit
                    ? <>총 {fmtNum(users)} <span style={{ color: '#34d399', fontWeight: 700 }}>(자연 {fmtNum(organicUsers)})</span></>
                    : <span style={{ color: '#34d399' }}>{fmtNum(organicUsers)}명</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentList({ rows }: { rows: RecentRow[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary, #888)', fontSize: 11 }}>최근 자연 등록 없음</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.slice(0, 10).map((r, i) => {
        const isApt = (r.item_type ?? '').toLowerCase() === 'apt';
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '78px 1fr auto auto', gap: 8, alignItems: 'center',
            padding: '6px 10px', borderRadius: 6,
            background: 'var(--bg-base, #0d0e14)', border: '1px solid var(--border, #2a2b35)',
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', whiteSpace: 'nowrap' }}>
              {fmtKstDateHm(r.created_at)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {r.user_nickname || r.user_email_masked || '—'}
            </span>
            <span style={{ fontSize: 9, fontWeight: 800,
              padding: '1px 6px', borderRadius: 999,
              background: isApt ? 'rgba(96,165,250,0.18)' : 'rgba(251,191,36,0.16)',
              color: isApt ? '#60a5fa' : '#fbbf24',
            }}>{isApt ? '단지' : '종목'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {r.item_name ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SiteList({ rows }: { rows: SiteRow[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary, #888)', fontSize: 11 }}>분양현장 등록 없음</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {rows.slice(0, 5).map((r, i) => (
        <div key={(r.site_id ?? '') + i} style={{
          display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 8, alignItems: 'center',
          padding: '5px 10px', borderRadius: 5,
          background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(96,165,250,0.18)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary, #888)', textAlign: 'right' }}>{i + 1}</span>
          <span style={{ fontSize: 11, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {r.site_name ?? '—'}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary, #ccc)', whiteSpace: 'nowrap' }}>
            👤 {fmtNum(r.members)} {n(r.guests) > 0 && <span style={{ color: '#fbbf24' }}>· 게스트 {fmtNum(r.guests)}</span>}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary, #888)', whiteSpace: 'nowrap' }}>
            {fmtKstHm(r.last_added)}
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
