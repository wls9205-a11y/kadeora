'use client';
import { timeAgo as ago, fmt } from '@/lib/format';
import { useState, useEffect, useCallback, useRef } from 'react';

const C = { brand: '#3B7BF6', green: '#10B981', red: '#EF4444', amber: '#F59E0B', purple: '#8B5CF6', cyan: '#06B6D4' };
const card: React.CSSProperties = { background: '#0C1528', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 };
const bdr = 'rgba(255,255,255,0.06)';

export default function FocusTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [godRunning, setGodRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=focus').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); timerRef.current = setInterval(load, 30000); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [load]);

  const runGod = async () => {
    if (!confirm('전체 크론 실행?')) return;
    setGodRunning(true);
    try { const r = await fetch('/api/admin/god-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'all' }) }); const d = await r.json(); alert(d.success ? '✅ 완료' : '❌ 실패'); load(); } catch { alert('❌ 에러'); }
    setGodRunning(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60 }}>⚠️ 로드 실패</div>;

  const { healthScore = 0, kpi = {} as any, growth = {} as any, failedCrons = {}, recentActivity = [], dailyTrend = [] } = data;
  const sc = healthScore >= 71 ? C.green : healthScore >= 41 ? C.amber : C.red;
  const fc = Object.keys(failedCrons || {}).length;
  const cr = (kpi.cronSuccess + kpi.cronFail) > 0 ? Math.round(kpi.cronSuccess / (kpi.cronSuccess + kpi.cronFail) * 100) : 100;

  const alerts: string[] = [];
  if (kpi.returnRate === 0 && kpi.users > 0) alerts.push(`🔴 활동률 0% · ${kpi.users}명 전원 미활동`);
  if ((growth.notifReadRate ?? 0) === 0 && (growth.notifTotal7d ?? 0) > 50) alerts.push(`🔴 알림 열람 0%`);
  if (fc > 0) alerts.push(`🟡 크론 실패 ${fc}개`);
  if ((growth.ctaCtr ?? 0) < 1 && (growth.ctaViews7d ?? 0) > 30) alerts.push(`🟡 CTA CTR ${growth.ctaCtr}%`);
  if (kpi.pushSubs + kpi.emailSubs === 0) alerts.push('🟠 구독자 0명');

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* ── 헬스 + GOD MODE ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ ...card, flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${sc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: sc }}>{healthScore}</div>
          <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>시스템 건강</div><div style={{ fontSize: 14, fontWeight: 700, color: sc }}>{healthScore >= 71 ? '양호' : healthScore >= 41 ? '주의' : '위험'}</div></div>
        </div>
        <button onClick={runGod} disabled={godRunning} style={{ ...card, flex: 1, cursor: godRunning ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg, #F59E0B22, #EF444422)', fontSize: 14, fontWeight: 800, color: C.amber, border: `1px solid ${C.amber}33`, borderRadius: 12 }}>
          ⚡ {godRunning ? '실행 중...' : '전체 크론'}
        </button>
      </div>

      {/* ── 위험 신호 ── */}
      {alerts.length > 0 && <div style={{ ...card, padding: '8px 12px' }}>{alerts.map((a, i) => <div key={i} style={{ fontSize: 11, padding: '2px 0', color: a.startsWith('🔴') ? C.red : C.amber, borderBottom: i < alerts.length - 1 ? `1px solid ${bdr}` : 'none' }}>{a}</div>)}</div>}

      {/* ── KPI 6칸 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
        {[
          { l: '실유저', v: kpi.users, c: C.brand, s: `+${kpi.newUsers}/7d` },
          { l: 'PV', v: fmt(kpi.pvToday), c: C.cyan, s: '오늘' },
          { l: '블로그', v: fmt(kpi.blogs), c: C.purple, s: `RW ${kpi.rewriteRate}%` },
          { l: '청약', v: fmt(kpi.apts), c: C.green, s: `관심 ${kpi.interests}` },
          { l: '종목', v: fmt(kpi.stocks), c: C.amber, s: `미분양 ${fmt(kpi.unsold)}` },
          { l: '크론', v: `${cr}%`, c: cr >= 95 ? C.green : C.red, s: `${kpi.cronFail}실패` },
        ].map(k => (
          <div key={k.l} style={{ ...card, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.c, lineHeight: 1.2 }}>{k.v}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{k.l}</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* ── 성장 2열 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>👤 유저</div>
          {[
            { l: '활동률', v: `${kpi.returnRate}%`, p: kpi.returnRate, c: kpi.returnRate > 10 ? C.green : C.red },
            { l: '프로필', v: `${growth.profileRate ?? 0}%`, p: growth.profileRate ?? 0, c: (growth.profileRate ?? 0) > 20 ? C.green : C.red },
            { l: '온보딩', v: `${growth.onboardRate ?? 0}%`, p: growth.onboardRate ?? 0, c: (growth.onboardRate ?? 0) > 50 ? C.green : C.amber },
          ].map(r => (
            <div key={r.l} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}><span style={{ color: 'var(--text-tertiary)' }}>{r.l}</span><span style={{ fontWeight: 700, color: r.c }}>{r.v}</span></div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(r.p, 2)}%`, background: r.c, borderRadius: 2 }} /></div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>🔔 리텐션</div>
          {[
            { l: '알림열람', v: `${growth.notifReadRate ?? 0}%`, c: (growth.notifReadRate ?? 0) > 10 ? C.green : C.red },
            { l: '푸시', v: `${kpi.pushSubs ?? 0}명`, c: (kpi.pushSubs ?? 0) > 0 ? C.green : C.red },
            { l: '이메일', v: `${kpi.emailSubs ?? 0}명`, c: (kpi.emailSubs ?? 0) > 0 ? C.green : C.red },
          ].map(r => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${bdr}`, fontSize: 10 }}><span style={{ color: 'var(--text-tertiary)' }}>{r.l}</span><span style={{ fontWeight: 700, color: r.c }}>{r.v}</span></div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 8, fontSize: 9 }}>
            {[
              { v: growth.ctaViews7d ?? 0, l: '노출', c: C.brand },
              { v: growth.ctaClicks7d ?? 0, l: '클릭', c: C.amber },
              { v: kpi.newUsers ?? 0, l: '가입', c: C.green },
            ].map((f, i) => (
              <>{i > 0 && <span style={{ color: 'var(--text-tertiary)' }}>→</span>}<div key={f.l} style={{ flex: 1, textAlign: 'center', padding: '3px 0', background: `${f.c}12`, borderRadius: 4 }}><div style={{ fontWeight: 800, color: f.c }}>{f.v}</div><div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{f.l}</div></div></>
            ))}
          </div>
        </div>
      </div>

      {/* ── 14일 트래픽 ── */}
      {dailyTrend?.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📊 14일 PV</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
            {dailyTrend.slice(-14).map((d: any, i: number) => {
              const mx = Math.max(...dailyTrend.slice(-14).map((x: any) => x.pv || 0), 1);
              return <div key={i} style={{ flex: 1, height: Math.max(((d.pv || 0) / mx) * 32, 2), background: i === dailyTrend.slice(-14).length - 1 ? C.brand : `${C.brand}44`, borderRadius: 2 }} title={`${d.date}: ${d.pv}PV`} />;
            })}
          </div>
        </div>
      )}

      {/* ── 시스템 + 실패크론 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: fc > 0 ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🔧 시스템</div>
          {[
            { l: '크론', p: cr, c: cr >= 95 ? C.green : C.amber, r: `${kpi.cronSuccess}/${kpi.cronSuccess + kpi.cronFail}` },
            { l: 'DB', p: Math.round((kpi.dbMb || 0) / 8400 * 100), c: (kpi.dbMb || 0) < 4000 ? C.green : C.amber, r: `${fmt(kpi.dbMb)}MB` },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 24 }}>{s.l}</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${s.p}%`, background: s.c, borderRadius: 3 }} /></div>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 50, textAlign: 'right' }}>{s.r}</span>
            </div>
          ))}
        </div>
        {fc > 0 && (
          <div style={{ ...card, borderLeft: `3px solid ${C.red}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 4 }}>❌ 실패 ({fc})</div>
            {Object.entries(failedCrons || {}).slice(0, 4).map(([n, info]: [string, any]) => (
              <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '2px 0', color: 'var(--text-tertiary)' }}><span>{n.replace(/^(blog-|cron-|apt-|stock-)/, '')}</span><span style={{ color: C.red, fontWeight: 600 }}>{info.count}회</span></div>
            ))}
          </div>
        )}
      </div>

      {/* ── 최근 활동 ── */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🕐 최근 활동</div>
        {(recentActivity || []).slice(0, 8).map((a: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: i < Math.min(recentActivity.length, 8) - 1 ? `1px solid ${bdr}` : 'none', fontSize: 10 }}>
            <span style={{ width: 40, fontSize: 8, color: 'var(--text-tertiary)', flexShrink: 0 }}>{ago(a.at)}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.type === 'cron' ? (a.status === 'success' ? C.green : C.red) : C.brand, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.name}</span>
            {a.count > 0 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{a.count}</span>}
          </div>
        ))}
      </div>

      {/* ── 콘텐츠 효율 ── */}
      {data.categoryStats && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📊 카테고리별 효율</div>
          {(data.categoryStats || []).slice(0, 5).map((cat: any) => (
            <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: `1px solid ${bdr}`, fontSize: 10 }}>
              <span style={{ width: 50, color: 'var(--text-tertiary)' }}>{cat.category}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(cat.efficiency * 2, 100)}%`, background: cat.efficiency > 50 ? C.green : cat.efficiency > 20 ? C.amber : C.red, borderRadius: 2 }} />
              </div>
              <span style={{ width: 45, textAlign: 'right', fontWeight: 700, color: cat.efficiency > 50 ? C.green : 'var(--text-tertiary)' }}>{cat.efficiency}v/p</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 빠른 이동 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {[{ l: '성장', i: '📈', t: 'growth' }, { l: '유저', i: '👤', t: 'users' }, { l: '크론', i: '🔧', t: 'ops' }, { l: '데이터', i: '🗄️', t: 'data' }].map(n => (
          <button key={n.t} onClick={() => onNavigate(n.t)} style={{ padding: '8px 4px', background: '#0C1528', border: `1px solid ${bdr}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 16 }}>{n.i}</div>{n.l}
          </button>
        ))}
      </div>
    </div>
  );
}
