'use client';

// /admin/signup-flow — 가입 funnel 진단 + 14일 일별 + 24h 시간대 + 가입자 상세.
// API: GET /api/admin/signup-flow?include_seed=1&user_limit=50&user_offset=0&user_search=...
// 30s 자동 갱신 + visibilitychange 즉시 갱신.
// 모든 렌더는 defensive — RPC 실패/필드 누락 시 "—" 또는 0 fallback.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

interface ApiResponse {
  ok: boolean;
  funnel_7d?: any;
  hourly_24h?: any[];
  users?: any;
  daily_14d?: any[];
  user_query?: { include_seed?: boolean; limit?: number; offset?: number; search?: string | null };
  errors?: string[];
  generated_at?: string;
}

// ─── 유틸 ──────────────────────────────────────────────
function n(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10; // 1 decimal
}
function fmtPct(p: number): string {
  return `${p.toFixed(1)}%`;
}
function fmtNum(v: any): string {
  return n(v).toLocaleString();
}
function fmtTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('ko-KR'); } catch { return iso.slice(11, 19) || '—'; }
}
function isSeedEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase().includes('kadeora-seed');
}

// ─── Funnel 정규화 ─────────────────────────────────────
// funnel_7d 가 다양한 모양으로 올 수 있어 (객체/배열) 단계 배열로 정규화.
const FUNNEL_STAGES: { key: string; label: string; aliases: string[] }[] = [
  { key: 'cta_view',         label: 'CTA 노출',     aliases: ['cta_views', 'cta_view_count', 'views'] },
  { key: 'cta_click',        label: 'CTA 클릭',     aliases: ['cta_clicks', 'cta_click_count', 'clicks'] },
  { key: 'signup_attempt',   label: '가입 시도',    aliases: ['signup_attempts', 'attempts'] },
  { key: 'oauth_start',      label: 'OAuth 시작',   aliases: ['oauth_starts'] },
  { key: 'oauth_callback',   label: 'OAuth 콜백',   aliases: ['oauth_callbacks', 'callbacks'] },
  { key: 'profile_created',  label: '프로필 생성',  aliases: ['profiles_created', 'profile_create'] },
  { key: 'signup_success',   label: '가입 성공',    aliases: ['signups', 'signup_count', 'success'] },
];

function normalizeFunnel(raw: any): { label: string; key: string; count: number }[] {
  // 1) 단순 객체: { cta_view: 100, cta_click: 13, ... }
  // 2) 배열: [{ stage: 'cta_view', count: 100 }, ...]
  // 3) 단일 row: { 7d_cta_view: 100, ... }
  const out: { label: string; key: string; count: number }[] = [];
  if (!raw) return FUNNEL_STAGES.map(s => ({ label: s.label, key: s.key, count: 0 }));

  // 배열 → key 추출
  if (Array.isArray(raw)) {
    const mp = new Map<string, number>();
    for (const r of raw) {
      const k = String(r?.stage || r?.step || r?.key || '').toLowerCase();
      if (k) mp.set(k, n(r?.count ?? r?.value ?? r?.cnt));
    }
    for (const s of FUNNEL_STAGES) {
      let v = mp.get(s.key);
      if (v == null) for (const a of s.aliases) { if (mp.has(a)) { v = mp.get(a); break; } }
      out.push({ label: s.label, key: s.key, count: v ?? 0 });
    }
    return out;
  }

  // 객체 → 키별 직접 lookup
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const s of FUNNEL_STAGES) {
      const candidates = [s.key, ...s.aliases, `7d_${s.key}`, `total_${s.key}`];
      let v: number = 0;
      for (const c of candidates) {
        if (obj[c] != null) { v = n(obj[c]); break; }
      }
      out.push({ label: s.label, key: s.key, count: v });
    }
    // dropped_step 분포·source 분포는 별도 추출 (있을 때만)
    return out;
  }
  return FUNNEL_STAGES.map(s => ({ label: s.label, key: s.key, count: 0 }));
}

function extractFromFunnel(raw: any, field: string): any {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return (raw as Record<string, unknown>)[field] ?? null;
}

// ─── Users 정규화 ──────────────────────────────────────
interface UserRow {
  id?: string;
  email?: string | null;
  created_at?: string | null;
  signup_source?: string | null;
  has_profile?: boolean | null;
  is_seed?: boolean | null;
  last_drop_step?: string | null;
  signed_up?: boolean | null;
  status?: string | null;
}
function normalizeUsers(raw: any): { rows: UserRow[]; total: number | null } {
  if (!raw) return { rows: [], total: null };
  if (Array.isArray(raw)) return { rows: raw as UserRow[], total: null };
  if (typeof raw === 'object') {
    const rows = Array.isArray(raw.rows) ? raw.rows : Array.isArray(raw.data) ? raw.data : [];
    const total = typeof raw.total === 'number' ? raw.total : typeof raw.count === 'number' ? raw.count : null;
    return { rows, total };
  }
  return { rows: [], total: null };
}

// ─── 컴포넌트 ──────────────────────────────────────────
const REFRESH_MS = 30_000;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export default function SignupFlowClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  // user filter state
  const [includeSeed, setIncludeSeed] = useState(false);
  const [userLimit, setUserLimit] = useState(50);
  const [userOffset, setUserOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const searchAppliedRef = useRef('');

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams();
    p.set('include_seed', includeSeed ? '1' : '0');
    p.set('user_limit', String(userLimit));
    p.set('user_offset', String(userOffset));
    if (searchAppliedRef.current) p.set('user_search', searchAppliedRef.current);
    return `/api/admin/signup-flow?${p.toString()}`;
  }, [includeSeed, userLimit, userOffset]);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch(buildUrl(), { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = (await r.json()) as ApiResponse;
        setData(j);
        setErr(null);
        setLastFetch(Date.now());
      })
      .catch((e) => setErr(e?.message ?? 'fetch failed'))
      .finally(() => setLoading(false));
  }, [buildUrl]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchData]);

  const onApplySearch = () => { searchAppliedRef.current = searchInput.trim().slice(0, 80); setUserOffset(0); fetchData(); };

  const funnel = useMemo(() => normalizeFunnel(data?.funnel_7d), [data?.funnel_7d]);
  const droppedSteps: { step: string; count: number }[] = useMemo(() => {
    const raw = extractFromFunnel(data?.funnel_7d, 'dropped_steps')
      ?? extractFromFunnel(data?.funnel_7d, 'dropped_step_distribution')
      ?? extractFromFunnel(data?.funnel_7d, 'drops');
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((r: any) => ({
        step: String(r?.step || r?.stage || r?.dropped_step || '?'),
        count: n(r?.count ?? r?.cnt ?? r?.value),
      })).filter(d => d.step && d.step !== '?').sort((a, b) => b.count - a.count);
    }
    if (typeof raw === 'object') {
      return Object.entries(raw as Record<string, unknown>)
        .map(([step, count]) => ({ step, count: n(count) }))
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count);
    }
    return [];
  }, [data?.funnel_7d]);

  const sourceRows: { source: string; clicks: number; signups: number; rate: number }[] = useMemo(() => {
    const raw = extractFromFunnel(data?.funnel_7d, 'sources')
      ?? extractFromFunnel(data?.funnel_7d, 'source_breakdown')
      ?? extractFromFunnel(data?.funnel_7d, 'by_source');
    if (!Array.isArray(raw)) return [];
    return (raw as any[]).map((r) => {
      const clicks = n(r?.clicks ?? r?.cta_clicks ?? r?.attempts);
      const signups = n(r?.signups ?? r?.success ?? r?.signup_success);
      return {
        source: String(r?.source ?? r?.signup_source ?? 'unknown'),
        clicks, signups,
        rate: pct(signups, clicks),
      };
    }).sort((a, b) => b.clicks - a.clicks);
  }, [data?.funnel_7d]);

  const stageMap = useMemo(() => Object.fromEntries(funnel.map(f => [f.key, f.count])), [funnel]);
  const exposeToSignup = pct(stageMap['signup_success'] ?? 0, stageMap['cta_view'] ?? 0);
  const clickToAttempt = pct(stageMap['signup_attempt'] ?? 0, stageMap['cta_click'] ?? 0);
  const attemptToSignup = pct(stageMap['signup_success'] ?? 0, stageMap['signup_attempt'] ?? 0);

  const hourly = data?.hourly_24h ?? [];
  const daily = data?.daily_14d ?? [];
  const { rows: userRows, total: userTotal } = useMemo(() => normalizeUsers(data?.users), [data?.users]);

  // ─── 렌더 ────────────────────────────────────────────
  return (
    <div style={{
      maxWidth: 1400, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)',
      display: 'flex', flexDirection: 'column', gap: 16,
      color: 'var(--text-primary, #e5e7eb)',
      background: 'var(--bg-base, #0d0e14)',
      minHeight: '100vh',
    }}>
      {/* 헤더 */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 14px', borderRadius: 10,
        background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
      }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 가입 플로우 진단</h1>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
          dropped_step / OAuth / source 별 funnel 회귀 모니터링
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {data?.errors && data.errors.length > 0 && (
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(248,113,113,0.12)', color: '#fca5a5' }} title={data.errors.join('\n')}>
              ⚠ rpc 부분 실패 {data.errors.length}건
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-tertiary, #888)' }}>
            {lastFetch ? `${fmtTime(new Date(lastFetch).toISOString())} · 30s 자동` : '로드 중'}
          </span>
          <button onClick={fetchData} style={btnGhost()}>↻ 새로고침</button>
        </div>
      </header>

      {loading && !data && <Banner>로드 중…</Banner>}
      {err && <Banner tone="danger">데이터 가져오기 실패: {err}</Banner>}

      {data && (
        <>
          {/* 1) 7일 Funnel */}
          <Section title="7일 Funnel" subtitle="CTA 노출 → 클릭 → 시도 → OAuth → 콜백 → 프로필 → 성공">
            <FunnelBars rows={funnel} />
          </Section>

          {/* 2) 이탈 분석 */}
          <Section title="이탈 분석" subtitle="단계 간 전환율">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <DropCard label="노출 → 가입" pct={exposeToSignup} num={stageMap['signup_success'] ?? 0} den={stageMap['cta_view'] ?? 0} thresholds={{ green: 1, orange: 0.3 }} />
              <DropCard label="클릭 → 시도" pct={clickToAttempt} num={stageMap['signup_attempt'] ?? 0} den={stageMap['cta_click'] ?? 0} thresholds={{ green: 30, orange: 10 }} />
              <DropCard label="시도 → 성공" pct={attemptToSignup} num={stageMap['signup_success'] ?? 0} den={stageMap['signup_attempt'] ?? 0} thresholds={{ green: 60, orange: 30 }} />
            </div>
          </Section>

          {/* 3) dropped_step 분포 */}
          {droppedSteps.length > 0 && (
            <Section title="7일 dropped_step 분포" subtitle="가장 많이 이탈한 단계">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {droppedSteps.slice(0, 12).map((d) => (
                  <span key={d.step} style={{
                    padding: '6px 12px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700,
                    background: 'rgba(248,113,113,0.10)', color: '#fca5a5',
                    border: '1px solid rgba(248,113,113,0.25)',
                  }}>
                    {d.step} <span style={{ marginLeft: 4, opacity: 0.85 }}>{fmtNum(d.count)}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* 4) source × 성공률 */}
          {sourceRows.length > 0 && (
            <Section title="7일 source × 성공률" subtitle="유입 경로별 클릭→가입 전환">
              <Table head={['source', '클릭', '가입', '전환율']}>
                {sourceRows.map((r) => (
                  <tr key={r.source}>
                    <Td>{r.source}</Td>
                    <Td align="right">{fmtNum(r.clicks)}</Td>
                    <Td align="right">{fmtNum(r.signups)}</Td>
                    <Td align="right">
                      <span style={{ color: r.rate >= 30 ? '#34d399' : r.rate >= 10 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                        {fmtPct(r.rate)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </Table>
            </Section>
          )}

          {/* 5) 14일 일별 */}
          <Section title="14일 일별 진단" subtitle="signups_real=0 인 날 강조 (회귀 의심)">
            <DailyTable rows={daily} />
          </Section>

          {/* 6) 24h 시간대별 */}
          <Section title="24h 시간대별 트래픽" subtitle="방문 / CTA 클릭 / 실 가입 / 시드">
            <HourlyChart rows={hourly} />
          </Section>

          {/* 7) 가입자 상세 */}
          <Section title="가입자 상세" subtitle="시드/실 토글, 이메일/소스 검색, 페이징">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <input
                  type="checkbox"
                  checked={includeSeed}
                  onChange={(e) => { setIncludeSeed(e.target.checked); setUserOffset(0); }}
                />
                시드 포함
              </label>
              <select value={userLimit} onChange={(e) => { setUserLimit(Number(e.target.value)); setUserOffset(0); }} style={selStyle()}>
                {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}건</option>)}
              </select>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onApplySearch(); }}
                placeholder="이메일/소스 검색 (Enter)"
                style={{
                  flex: 1, minWidth: 180,
                  padding: '6px 10px', borderRadius: 6,
                  fontSize: 11, color: 'var(--text-primary)',
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  outline: 'none',
                }}
              />
              <button onClick={onApplySearch} style={btnGhost()}>검색</button>
              {userTotal != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>총 {fmtNum(userTotal)}건</span>}
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <button
                  onClick={() => setUserOffset(Math.max(0, userOffset - userLimit))}
                  disabled={userOffset === 0}
                  style={btnGhost(userOffset === 0)}
                >‹ 이전</button>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center', padding: '0 6px' }}>
                  {userOffset + 1}~{userOffset + userRows.length}
                </span>
                <button
                  onClick={() => setUserOffset(userOffset + userLimit)}
                  disabled={userRows.length < userLimit}
                  style={btnGhost(userRows.length < userLimit)}
                >다음 ›</button>
              </div>
            </div>
            <UserTable rows={userRows} />
          </Section>

          <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-tertiary, #888)', textAlign: 'right' }}>
            생성 시각: {data.generated_at ?? '—'}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────
// 하위 컴포넌트
// ───────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{
      padding: '14px 16px', borderRadius: 10,
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{title}</h2>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Banner({ tone = 'default', children }: { tone?: 'default' | 'danger'; children: React.ReactNode }) {
  const dangerC = tone === 'danger';
  return (
    <div style={{
      padding: 14, borderRadius: 10,
      background: dangerC ? 'rgba(248,113,113,0.08)' : 'var(--bg-elevated)',
      border: dangerC ? '1px solid rgba(248,113,113,0.4)' : '1px solid var(--border)',
      color: dangerC ? '#f87171' : 'var(--text-tertiary)',
      fontSize: 12,
    }}>{children}</div>
  );
}

function FunnelBars({ rows }: { rows: { label: string; key: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => {
        const w = max > 0 ? (r.count / max) * 100 : 0;
        // 이전 단계 대비 통과율 (funnel 본질이 매 단계 줄어드는 것이므로 빨간 -% 대신 "통과율" 표기)
        const prev = i > 0 ? rows[i - 1].count : 0;
        const passRate = prev > 0 ? (r.count / prev) * 100 : null;
        const passColor = passRate == null
          ? 'var(--text-tertiary)'
          : passRate >= 70 ? '#34d399'
          : passRate >= 30 ? '#fbbf24'
          : '#f87171';
        return (
          <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 90px', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{r.label}</span>
            <div style={{ height: 22, background: 'var(--bg-base)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, textAlign: 'right' }}>{fmtNum(r.count)}</span>
            <span style={{ fontSize: 10, color: passColor, fontWeight: 700, textAlign: 'right' }} title="이전 단계 대비 통과율">
              {passRate == null ? '—' : `통과 ${passRate.toFixed(0)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DropCard({ label, pct, num, den, thresholds }: { label: string; pct: number; num: number; den: number; thresholds: { green: number; orange: number } }) {
  const c = pct >= thresholds.green ? '#34d399' : pct >= thresholds.orange ? '#fbbf24' : '#f87171';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: c, marginTop: 4 }}>{fmtPct(pct)}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtNum(num)} / {fmtNum(den)}</div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{
                textAlign: i === 0 ? 'left' : 'right',
                padding: '8px 10px', fontSize: 10, fontWeight: 800,
                color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)',
                letterSpacing: 1,
              }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, align = 'left', highlight = false }: { children: React.ReactNode; align?: 'left' | 'right'; highlight?: boolean }) {
  return (
    <td style={{
      padding: '8px 10px', textAlign: align,
      borderBottom: '1px solid var(--border)',
      color: highlight ? '#f87171' : 'inherit',
      fontWeight: highlight ? 800 : 500,
    }}>{children}</td>
  );
}

function DailyTable({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return <Banner>14일 데이터가 없습니다.</Banner>;
  // 정렬: 최신 날짜가 위로 (이미 desc 가정)
  return (
    <Table head={['일자', 'UV', 'CTA 클릭', '시도', 'OAuth 시작', '실 가입', '시드', '주 dropped']}>
      {rows.map((r, i) => {
        const day = r.day || r.stat_date || r.date || '-';
        const uv = n(r.uv ?? r.unique_visitors ?? r.visitors);
        const cta = n(r.cta_clicks ?? r.clicks);
        const att = n(r.signup_attempts ?? r.attempts);
        // s209 — view 신규 컬럼 매핑: oauth_started (bigint), signups_seed (bigint), top_dropped_step (text)
        const oauth = n(r.oauth_started ?? r.oauth_start ?? r.oauth_starts);
        const real = n(r.signups_real ?? r.signups ?? r.real_signups);
        const seed = n(r.signups_seed ?? r.seed_signups);
        const dropped = String(r.top_dropped_step ?? r.dropped_step ?? r.main_drop ?? '');
        const realZero = real === 0 && uv > 0;
        return (
          <tr key={i} style={{ background: realZero ? 'rgba(248,113,113,0.06)' : 'transparent' }}>
            <Td>{String(day).slice(0, 10)}</Td>
            <Td align="right">{fmtNum(uv)}</Td>
            <Td align="right">{fmtNum(cta)}</Td>
            <Td align="right">{fmtNum(att)}</Td>
            <Td align="right">{fmtNum(oauth)}</Td>
            <Td align="right" highlight={realZero}>{fmtNum(real)}</Td>
            <Td align="right">{fmtNum(seed)}</Td>
            <Td align="right">{dropped || '—'}</Td>
          </tr>
        );
      })}
    </Table>
  );
}

function HourlyChart({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return <Banner>24h 데이터가 없습니다.</Banner>;
  // ascending 정렬 (hour 0 → 23)
  const sorted = [...rows].sort((a, b) => n(a?.hour ?? a?.hh) - n(b?.hour ?? b?.hh));

  const W = 720, H = 200, PADX = 30, PADY = 16;
  const series: { key: string; label: string; color: string; pick: (r: any) => number }[] = [
    { key: 'visits',       label: '방문',     color: '#60a5fa', pick: (r) => n(r?.visits ?? r?.uv ?? r?.unique_visitors) },
    { key: 'cta_clicks',   label: 'CTA 클릭', color: '#fbbf24', pick: (r) => n(r?.cta_clicks ?? r?.clicks) },
    { key: 'signups_real', label: '실 가입',  color: '#34d399', pick: (r) => n(r?.signups_real ?? r?.signups ?? r?.real_signups) },
    { key: 'signups_seed', label: '시드',     color: '#9ca3af', pick: (r) => n(r?.signups_seed ?? r?.seed_signups) },
  ];
  const all: number[] = [];
  for (const s of series) for (const r of sorted) all.push(s.pick(r));
  const max = Math.max(1, ...all);

  const xAt = (i: number) => sorted.length > 1 ? PADX + (i / (sorted.length - 1)) * (W - 2 * PADX) : W / 2;
  const yAt = (v: number) => H - PADY - (v / max) * (H - 2 * PADY);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', minWidth: 360 }}>
        {/* y grid */}
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const y = H - PADY - p * (H - 2 * PADY);
          return <line key={p} x1={PADX} x2={W - PADX} y1={y} y2={y} stroke="var(--border, #2a2b35)" strokeDasharray="2 4" strokeWidth={1} />;
        })}
        {/* x labels every 4h */}
        {sorted.map((r, i) => {
          const hh = n(r?.hour ?? r?.hh);
          if (hh % 4 !== 0) return null;
          return <text key={i} x={xAt(i)} y={H - 2} fontSize={9} textAnchor="middle" fill="var(--text-tertiary, #888)">{hh}h</text>;
        })}
        {/* lines */}
        {series.map((s) => {
          const path = sorted.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(s.pick(r)).toFixed(1)}`).join(' ');
          return <path key={s.key} d={path} stroke={s.color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {series.map((s) => (
          <span key={s.key} style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: s.color, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>최대 {fmtNum(max)}</span>
      </div>
    </div>
  );
}

function UserTable({ rows }: { rows: UserRow[] }) {
  if (!rows || rows.length === 0) return <Banner>가입자 데이터가 없습니다.</Banner>;
  return (
    <Table head={['가입일시', '이메일', '소스', '프로필', '시드', '마지막 이탈']}>
      {rows.map((r, i) => {
        const seed = r.is_seed ?? isSeedEmail(r.email);
        const created = r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '—';
        return (
          <tr key={r.id ?? i}>
            <Td>{created}</Td>
            <Td>
              <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{r.email ?? '—'}</span>
              {seed && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(156,163,175,0.20)', color: '#9ca3af' }}>seed</span>}
            </Td>
            <Td>{r.signup_source ?? '—'}</Td>
            <Td align="right">{r.has_profile === true ? '✓' : r.has_profile === false ? '×' : '—'}</Td>
            <Td align="right">{seed ? '·' : '실'}</Td>
            <Td align="right" highlight={!!r.last_drop_step}>{r.last_drop_step ?? '—'}</Td>
          </tr>
        );
      })}
    </Table>
  );
}

// ─── 스타일 헬퍼 ───────────────────────────────────────
function btnGhost(disabled: boolean = false): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700,
    padding: '6px 12px', borderRadius: 6,
    background: 'transparent',
    color: disabled ? 'var(--text-tertiary, #555)' : 'var(--text-secondary, #ccc)',
    border: '1px solid var(--border, #2a2b35)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
function selStyle(): React.CSSProperties {
  return {
    padding: '6px 10px', borderRadius: 6,
    fontSize: 11, fontWeight: 700,
    background: 'var(--bg-base)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', cursor: 'pointer', outline: 'none',
  };
}
