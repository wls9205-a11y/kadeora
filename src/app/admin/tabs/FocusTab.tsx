'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ── 유틸 ──
const f = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
const pct = (a: number, b: number) => b > 0 ? Math.round(a / b * 100) : 0;
const ago = (d: string) => { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분' : s < 86400 ? Math.floor(s / 3600) + '시' : Math.floor(s / 86400) + '일'; };

// ── 벤치마크 기준표 ──
type Grade = 'good' | 'warn' | 'critical';
const BENCH: Record<string, { label: string; good: string; warn: string; crit: string; check: (v: number) => Grade }> = {
  ctaCtr:     { label: 'CTA 클릭률', good: '>2%', warn: '0.5~2%', crit: '<0.5%', check: v => v > 2 ? 'good' : v > 0.5 ? 'warn' : 'critical' },
  signupRate: { label: '가입 전환율', good: '>1%', warn: '0.3~1%', crit: '<0.3%', check: v => v > 1 ? 'good' : v > 0.3 ? 'warn' : 'critical' },
  cronRate:   { label: '크론 성공률', good: '>95%', warn: '80~95%', crit: '<80%', check: v => v > 95 ? 'good' : v > 80 ? 'warn' : 'critical' },
  dbUsage:    { label: 'DB 사용률', good: '<50%', warn: '50~80%', crit: '>80%', check: v => v < 50 ? 'good' : v < 80 ? 'warn' : 'critical' },
  gateCtr:    { label: '게이트 CTR', good: '>3%', warn: '1~3%', crit: '<1%', check: v => v > 3 ? 'good' : v > 1 ? 'warn' : 'critical' },
  profileRate:{ label: '프로필 완성률', good: '>30%', warn: '10~30%', crit: '<10%', check: v => v > 30 ? 'good' : v > 10 ? 'warn' : 'critical' },
  notifRead:  { label: '알림 열람률', good: '>30%', warn: '15~30%', crit: '<15%', check: v => v > 30 ? 'good' : v > 15 ? 'warn' : 'critical' },
  returnRate: { label: '재방문율', good: '>30%', warn: '10~30%', crit: '<10%', check: v => v > 30 ? 'good' : v > 10 ? 'warn' : 'critical' },
};
const gradeColor = (g: Grade) => g === 'good' ? '#10B981' : g === 'warn' ? '#F59E0B' : '#EF4444';
const gradeIcon = (g: Grade) => g === 'good' ? '🟢' : g === 'warn' ? '🟡' : '🔴';
const GaugeRing = ({ value, max = 100, size = 72, color }: { value: number; max?: number; size?: number; color: string }) => {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, off = circ - (Math.min(value, max) / max) * circ;
  return <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dashoffset 1s'}}/></svg>;
};
const Spark = ({ data, color = '#3B7BF6', h = 32 }: { data: number[]; color?: string; h?: number }) => {
  if (!data || data.length < 2) return null;
  const mx = Math.max(...data, 1), w = 120;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / mx) * (h - 4)}`).join(' ');
  return <svg width={w} height={h} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /><circle cx={w} cy={h - (data[data.length - 1] / mx) * (h - 4)} r="2" fill={color} /></svg>;
};

export default function FocusTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [ld, setLd] = useState(true);
  const [godRunning, setGodRunning] = useState(false);
  const [godResult, setGodResult] = useState<{ ok: number; fail: number } | null>(null);
  const ref = useRef<any>(null);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=focus').then(r => r.json()).then(v => { setD(v); setLd(false); }).catch(() => setLd(false));
  }, []);
  useEffect(() => { load(); ref.current = setInterval(load, 30000); return () => clearInterval(ref.current); }, [load]);

  if (ld) return <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>;
  if (!d) return <div style={{ textAlign: 'center', padding: 80, fontSize: 13 }}>⚠️ 로드 실패</div>;

  const { healthScore: hs = 0, kpi: k = {} as any, growth: g = {} as any, extended: x = {} as any, failedCrons: fc = {}, recentActivity: ra = [], dailyTrend: dt = [], ctaBreakdown: cb = {}, signupSources: ss = {}, retention: ret = null as any, featureHealth: fh = {} as any, trafficDetail: td = {} as any } = d;

  // ── 벤치마크 계산 ──
  const cronRate = pct(k.cronSuccess, k.cronSuccess + k.cronFail);
  const ctrVal = (g.ctaViews7d || 0) > 0 ? (g.ctaClicks7d || 0) / g.ctaViews7d * 100 : 0;
  const signupRate = (x.pv7d || 0) > 0 ? (k.newUsers || 0) / (x.pv7d || 1) * 100 : 0;
  const dbPct = pct(k.dbMb || 0, 8400);
  const gateCtr = (x.gateViews || 0) > 0 ? (x.gateClicks || 0) / x.gateViews * 100 : 0;
  const profRate = g.profileRate || 0;
  const notifRate = g.notifReadRate || 0;
  const retRate = k.returnRate || 0;

  const benchResults: { key: string; value: number; grade: Grade }[] = [
    { key: 'ctaCtr', value: ctrVal, grade: BENCH.ctaCtr.check(ctrVal) },
    { key: 'signupRate', value: signupRate, grade: BENCH.signupRate.check(signupRate) },
    { key: 'cronRate', value: cronRate, grade: BENCH.cronRate.check(cronRate) },
    { key: 'dbUsage', value: dbPct, grade: BENCH.dbUsage.check(dbPct) },
    { key: 'gateCtr', value: gateCtr, grade: BENCH.gateCtr.check(gateCtr) },
    { key: 'profileRate', value: profRate, grade: BENCH.profileRate.check(profRate) },
    { key: 'notifRead', value: notifRate, grade: BENCH.notifRead.check(notifRate) },
    { key: 'returnRate', value: retRate, grade: BENCH.returnRate.check(retRate) },
  ];
  const criticals = benchResults.filter(b => b.grade === 'critical');
  const warnings = benchResults.filter(b => b.grade === 'warn');
  const fcn = Object.keys(fc || {}).length;
  const hourly = td?.hourlyPv || [];
  const hsColor = hs >= 71 ? '#10B981' : hs >= 41 ? '#F59E0B' : '#EF4444';

  // ── God Mode ──
  const runGodMode = async () => {
    if (godRunning) return;
    if (!confirm('전체 크론을 실행합니다. 계속?')) return;
    setGodRunning(true); setGodResult(null);
    try {
      const r = await fetch('/api/admin/god-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'full' }) });
      const data = await r.json();
      const ok = (data.results || []).filter((x: any) => x.status >= 200 && x.status < 400).length;
      setGodResult({ ok, fail: (data.results || []).length - ok });
      load();
    } catch { setGodResult({ ok: 0, fail: 1 }); }
    finally { setGodRunning(false); }
  };

  return (
    <div>
      {/* ═══ 1. 헬스 스코어 + 원버튼 ═══ */}
      <div className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <GaugeRing value={hs} color={hsColor} size={72} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: hsColor, lineHeight: 1 }}>{hs}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>HEALTH</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[
              { l: 'PV 오늘', v: f(k.pvToday || 0), c: '#3B7BF6' },
              { l: '신규 가입', v: `+${k.newUsersToday || 0}`, c: '#10B981' },
              { l: '실유저', v: f(k.users || 0), c: '#E2E8F0' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={runGodMode} disabled={godRunning} style={{
          padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
          background: godRunning ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3B7BF6, #10B981)', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, minWidth: 56,
          opacity: godRunning ? 0.5 : 1, transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: 18 }}>{godRunning ? '⏳' : '🚀'}</span>
          {godRunning ? '실행중' : '최신화'}
        </button>
      </div>
      {godResult && (
        <div style={{ padding: '6px 12px', borderRadius: 8, marginBottom: 8, fontSize: 11, fontWeight: 600, background: godResult.fail > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: godResult.fail > 0 ? '#EF4444' : '#10B981', textAlign: 'center' }}>
          ✓ {godResult.ok}성공 {godResult.fail > 0 && `· ✗ ${godResult.fail}실패`}
        </div>
      )}

      {/* ═══ 2. 경고 배너 ═══ */}
      {(criticals.length > 0 || fcn > 0) && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 6 }}>⚠️ 개선 필요 ({criticals.length + (fcn > 0 ? 1 : 0)}건)</div>
          {criticals.map(b => (
            <div key={b.key} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 3, display: 'flex', gap: 6 }}>
              <span>🔴</span>
              <span><strong>{BENCH[b.key].label}</strong> {b.value.toFixed(1)}% — 기준 {BENCH[b.key].crit}</span>
            </div>
          ))}
          {fcn > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 6 }}>
              <span>🔴</span>
              <span><strong>실패 크론</strong> {fcn}개 — <button onClick={() => onNavigate('ops')} style={{ background: 'none', border: 'none', color: '#3B7BF6', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}>확인하기</button></span>
            </div>
          )}
        </div>
      )}
      {warnings.length > 0 && criticals.length === 0 && (
        <div style={{ padding: '8px 14px', borderRadius: 10, marginBottom: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 11, color: '#F59E0B' }}>
            ⚡ 주의: {warnings.map(w => BENCH[w.key].label).join(', ')} 개선 권장
          </div>
        </div>
      )}

      {/* ═══ 3. 벤치마크 기준표 ═══ */}
      <div className="adm-sec">📋 운영 기준표</div>
      <div className="adm-card" style={{ padding: '6px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 40px 40px', gap: 0, fontSize: 10, color: 'rgba(255,255,255,0.25)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 600 }}>
          <span>지표</span><span style={{ textAlign: 'right' }}>현재</span><span style={{ textAlign: 'center' }}>기준</span><span style={{ textAlign: 'center' }}>상태</span>
        </div>
        {benchResults.map(b => (
          <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 40px 40px', gap: 0, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{BENCH[b.key].label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor(b.grade), textAlign: 'right' }}>{b.value.toFixed(1)}%</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>{BENCH[b.key].good}</span>
            <span style={{ textAlign: 'center', fontSize: 10 }}>{gradeIcon(b.grade)}</span>
          </div>
        ))}
      </div>

      {/* ═══ 4. 전환 퍼널 ═══ */}
      <div className="adm-sec">🎯 전환 퍼널 (7일)</div>
      <div className="adm-card" style={{ padding: '14px 16px' }}>
        {(() => {
          const steps = [
            { label: 'PV', value: x.pv7d || 0, color: '#3B7BF6' },
            { label: 'UV', value: td?.uniqueVisitors || k.users || 0, color: '#8B5CF6' },
            { label: '게이트 노출', value: x.gateViews || 0, color: '#F59E0B' },
            { label: '게이트 클릭', value: x.gateClicks || 0, color: '#EF4444' },
            { label: '가입 시도', value: x.signupAttempts7d || 0, color: '#EC4899' },
            { label: '가입 성공', value: k.newUsers || 0, color: '#10B981' },
          ];
          const maxV = Math.max(...steps.map(s => s.value), 1);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((s, i) => {
                const prev = i > 0 ? steps[i - 1].value : s.value;
                const dropRate = prev > 0 && i > 0 ? Math.round((1 - s.value / prev) * 100) : 0;
                return (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
                      <span style={{ fontWeight: 700, color: s.color }}>
                        {f(s.value)}
                        {i > 0 && dropRate > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>-{dropRate}%</span>}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max((s.value / maxV) * 100, 1)}%`, background: s.color, borderRadius: 3, transition: 'width 0.8s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ═══ 5. CTA 성과 ═══ */}
      <div className="adm-sec">🎪 CTA 성과 (7일)</div>
      <div className="adm-card" style={{ padding: '6px 12px' }}>
        {(() => {
          const allViews = Object.values(cb || {}).reduce((s: number, e: any) => s + (e.views || 0), 0);
          const allClicks = Object.values(cb || {}).reduce((s: number, e: any) => s + (e.clicks || 0), 0);
          const avgCtr = allViews > 0 ? allClicks / allViews * 100 : 0;
          return (
            <div style={{ display: 'flex', gap: 8, padding: '8px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#E2E8F0' }}>{f(allViews)}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>노출</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#E2E8F0' }}>{f(allClicks)}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>클릭</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: gradeColor(BENCH.ctaCtr.check(avgCtr)) }}>{avgCtr.toFixed(2)}%</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>평균 CTR</div>
              </div>
            </div>
          );
        })()}
        {Object.entries(cb || {}).sort((a: any, b: any) => (b[1].views || 0) - (a[1].views || 0)).slice(0, 10).map(([name, e]: [string, any]) => {
          const views = e.views || 0, clicks = e.clicks || 0;
          const ctr = views > 0 ? clicks / views * 100 : 0;
          const grade = BENCH.ctaCtr.check(ctr);
          return (
            <div key={name} style={{ display: 'flex', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 11, alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 8 }}>{gradeIcon(grade)}</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ width: 36, textAlign: 'right', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{f(views)}</span>
              <span style={{ width: 30, textAlign: 'right', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{clicks}</span>
              <span style={{ width: 42, textAlign: 'right', fontWeight: 700, color: gradeColor(grade), fontSize: 11 }}>{ctr.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      {/* ═══ 6. 시간대별 트래픽 ═══ */}
      {hourly.length > 0 && (<>
        <div className="adm-sec">📊 시간대별 트래픽 (오늘)</div>
        <div className="adm-card" style={{ padding: '10px 12px' }}>
          {(() => {
            const hmx = Math.max(...hourly.map((h: any) => h.count || 0), 1);
            const now = new Date().getHours();
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 50 }}>
                  {hourly.map((v: any, i: number) => (
                    <div key={i} style={{ flex: 1, height: Math.max(((v.count || 0) / hmx) * 40, 2), borderRadius: 2, background: v.hour === now ? '#10B981' : (v.count || 0) > 40 ? 'rgba(59,123,246,0.5)' : 'rgba(59,123,246,0.15)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', marginTop: 4 }}>
                  {[0, 6, 12, 18, 23].map(h => <span key={h} style={{ flex: 1, fontSize: 8, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>{h}시</span>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>오늘 {f(td?.todayTotal || k.pvToday || 0)} PV · {td?.uniqueVisitors || '—'} UV</span>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>피크 {hourly.reduce((m: any, h: any) => (h.count || 0) > (m.count || 0) ? h : m, { hour: 0, count: 0 }).hour}시</span>
                </div>
              </>
            );
          })()}
        </div>
      </>)}

      {/* ═══ 7. 유입경로 + 인기 페이지 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {td?.referrerBreakdown && td.referrerBreakdown.length > 0 && (
          <div className="adm-card" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>유입 경로</div>
            {td.referrerBreakdown.slice(0, 5).map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', color: 'rgba(255,255,255,0.4)' }}>
                <span>{r.source}</span><span style={{ fontWeight: 600 }}>{r.count}</span>
              </div>
            ))}
          </div>
        )}
        {td?.topPages && td.topPages.length > 0 && (
          <div className="adm-card" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>인기 페이지</div>
            {td.topPages.slice(0, 5).map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', color: 'rgba(255,255,255,0.4)', gap: 4 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{decodeURIComponent(p.path)}</span>
                <span style={{ fontWeight: 600, flexShrink: 0 }}>{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 8. KPI 그리드 ═══ */}
      <div className="adm-sec">📊 핵심 지표</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {[
          { l: '블로그', v: f(k.blogs || 0), c: '#8B5CF6', sub: `핫 ${f(x.hotBlogs || 0)}` },
          { l: '주식', v: f(k.stocks || 0), c: '#3B7BF6', sub: `종목` },
          { l: '분양', v: f(k.apts || 0), c: '#10B981', sub: `미분양 ${f(k.unsold || 0)}` },
          { l: '크론', v: `${cronRate}%`, c: gradeColor(BENCH.cronRate.check(cronRate)), sub: `${k.cronSuccess || 0}/${(k.cronSuccess || 0) + (k.cronFail || 0)}` },
          { l: '이메일', v: f(k.emailSubs || 0), c: '#EC4899', sub: '구독자' },
          { l: '푸시', v: f(k.pushSubs || 0), c: '#F59E0B', sub: '구독자' },
          { l: '공유', v: f(x.shares7d || 0), c: '#A855F7', sub: `오늘 ${x.sharesToday || 0}` },
          { l: 'DB', v: `${(k.dbMb / 1024).toFixed(1)}G`, c: gradeColor(BENCH.dbUsage.check(dbPct)), sub: `/${8.4}G` },
        ].map(s => (
          <div key={s.l} className="adm-kpi-c" style={{ padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>{s.l}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.12)', marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══ 9. 기능 건강도 ═══ */}
      <div className="adm-sec">💪 기능 사용 현황</div>
      <div className="adm-card" style={{ padding: '8px 12px' }}>
        {[
          { l: '아파트 북마크', v: fh.aptBookmarks || 0 },
          { l: '블로그 북마크', v: fh.blogBookmarks || 0 },
          { l: '관심 종목', v: fh.stockWatchlist || 0 },
          { l: '가격 알림', v: fh.priceAlerts || 0 },
          { l: '출석', v: fh.attendance || 0 },
          { l: '미션', v: fh.missionCompleted || 0 },
        ].map(feat => (
          <div key={feat.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 10, color: feat.v > 0 ? '#10B981' : '#EF4444' }}>{feat.v > 0 ? '✓' : '✗'}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{feat.l}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: feat.v > 0 ? '#E2E8F0' : 'rgba(255,255,255,0.1)' }}>{feat.v}</span>
          </div>
        ))}
      </div>

      {/* ═══ 10. 14일 트래픽 추이 ═══ */}
      {dt.length > 0 && (<>
        <div className="adm-sec">📈 14일 추이</div>
        <div className="adm-card" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {dt.map((d: any, i: number) => {
              const mx = Math.max(...dt.map((x: any) => x.pv || 0), 1);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <div style={{ width: '100%', height: `${((d.pv || 0) / mx) * 45}px`, background: '#3B7BF6', borderRadius: 2, minHeight: 2, opacity: 0.3 }} />
                  <div style={{ width: '100%', height: `${((d.uv || 0) / mx) * 45}px`, background: '#3B7BF6', borderRadius: 2, minHeight: 2 }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', marginTop: 4 }}>
            {dt.map((d: any, i: number) => (
              <div key={i} style={{ flex: 1, fontSize: 7, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
                {i % 3 === 0 ? d.date?.slice(5) : ''}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, background: '#3B7BF6', opacity: 0.3, borderRadius: 1, marginRight: 3 }} />PV</span>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, background: '#3B7BF6', borderRadius: 1, marginRight: 3 }} />UV</span>
          </div>
        </div>
      </>)}

      {/* ═══ 11. 가입 경로 분석 ═══ */}
      {Object.keys(ss || {}).length > 0 && (<>
        <div className="adm-sec">🎯 가입 경로</div>
        <div className="adm-card" style={{ padding: '8px 12px' }}>
          {Object.entries(ss).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).map(([src, cnt]: [string, any]) => (
            <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{src}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{cnt}명</span>
            </div>
          ))}
        </div>
      </>)}

      {/* ═══ 12. 리텐션 ═══ */}
      {ret && (
        <div className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: gradeColor(BENCH.returnRate.check(ret.d7Rate || 0)) }}>{ret.d7Rate || 0}%</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>D7 리텐션</div>
          </div>
          <div style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            코호트 {ret.cohortWeek?.slice(5)} · {ret.size}명 중 {ret.d7}명 복귀
          </div>
        </div>
      )}

      {/* ═══ 13. 최근 활동 ═══ */}
      {ra.length > 0 && (<>
        <div className="adm-sec">🕐 최근 활동</div>
        <div className="adm-card" style={{ padding: '6px 12px' }}>
          {ra.slice(0, 6).map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.03)' : 'none', fontSize: 11 }}>
              <span style={{ fontSize: 10 }}>{a.type === 'cron' ? (a.status === 'success' ? '✅' : '❌') : '👤'}</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.type === 'cron' ? a.name : `${a.name} 가입`}
                {a.type === 'cron' && a.count > 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}> · {a.count}건</span>}
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>{ago(a.at)}</span>
            </div>
          ))}
        </div>
      </>)}

      {/* ═══ 14. 실시간 방문자 ═══ */}
      {(td?.recentVisitors || []).length > 0 && (<>
        <div className="adm-sec">👁 실시간 방문자</div>
        <div className="adm-card" style={{ padding: '6px 12px', maxHeight: 200, overflowY: 'auto' }}>
          {td.recentVisitors.slice(0, 10).map((v: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: 10 }}>
              <span>{v.device}</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{decodeURIComponent(v.path)}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 8, flexShrink: 0 }}>{v.ref}</span>
              <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 8, flexShrink: 0 }}>{ago(v.at)}</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}
