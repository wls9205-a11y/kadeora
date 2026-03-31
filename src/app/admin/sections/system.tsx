'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge, C, DataTable, KPICard, Pill, ProgressBar, Spinner, ago } from '../admin-shared';

export default function SystemSection() {
  const [tab, setTab] = useState<'crons' | 'infra' | 'env' | 'flags'>('crons');
  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text, margin: '0 0 16px' }}>⚙️ 시스템</h1>
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-lg)', flexWrap: 'wrap' }}>
        <Pill active={tab === 'crons'} onClick={() => setTab('crons')}>🔄 크론</Pill>
        <Pill active={tab === 'infra'} onClick={() => setTab('infra')}>🖥️ 인프라</Pill>
        <Pill active={tab === 'env'} onClick={() => setTab('env')}>🔑 환경변수</Pill>
        <Pill active={tab === 'flags'} onClick={() => setTab('flags')}>🚩 기능 플래그</Pill>
      </div>
      {tab === 'crons' && <CronTab />}
      {tab === 'infra' && <InfraTab />}
      {tab === 'env' && <EnvTab />}
      {tab === 'flags' && <FlagsTab />}
    </div>
  );
}

// ── 크론 탭 (기존) ──
function CronTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const load = useCallback((h = 24) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=system&hours=${h}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line

  if (loading) return <Spinner />;

  const crons: any[] = data?.crons ?? [];
  const totalRuns = data?.totalRuns ?? 0;
  const successRate = totalRuns > 0 ? Math.round((crons.reduce((s: number, c: any) => s + c.success, 0) / totalRuns) * 100) : 100;

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-lg)' }}>
        {[6, 12, 24, 48].map(h => <Pill key={h} active={hours === h} onClick={() => { setHours(h); load(h); }}>{h}시간</Pill>)}
      </div>
      <div className="mc-g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
        <KPICard icon="🔄" label="총 실행" value={totalRuns} color={C.brand} />
        <KPICard icon="✅" label="성공률" value={`${successRate}%`} color={successRate >= 90 ? C.green : C.yellow} />
        <KPICard icon="❌" label="실패 크론" value={crons.filter((c: any) => c.failed > 0).length} color={C.red} />
      </div>
      <DataTable
        headers={['크론', '실행', '성공', '실패', '평균시간', '마지막 실행', '상태', '에러']}
        rows={crons.map((c: any) => [
          <span key="n" style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{c.name}</span>,
          c.runs,
          <span key="s" style={{ color: C.green }}>{c.success}</span>,
          <span key="f" style={{ color: c.failed > 0 ? C.red : C.textDim, fontWeight: c.failed > 0 ? 700 : 400 }}>{c.failed}</span>,
          c.avgDuration ? `${(c.avgDuration / 1000).toFixed(1)}s` : '—',
          ago(c.lastRun),
          c.lastStatus === 'success' ? <Badge key="st" color={C.green}>OK</Badge> : <Badge key="st" color={C.red}>FAIL</Badge>,
          c.lastError ? <span key="e" style={{ color: C.red, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{c.lastError}</span> : '—',
        ])}
      />
    </>
  );
}

// ── 인프라 탭 ──
function InfraTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/infra-stats').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data || data.error) return <div style={{ color: C.red, textAlign: 'center', padding: 40 }}>인프라 데이터 로드 실패</div>;

  const db = data.dbStats;
  const dbPct = db ? Math.min(Math.round((db.db_size_bytes / (8 * 1024 * 1024 * 1024)) * 100), 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Supabase */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-md)' }}>⚡ Supabase (Pro)</div>
        {db ? (
          <>
            <ProgressBar value={dbPct} max={100} color={dbPct > 80 ? C.red : dbPct > 50 ? C.yellow : C.green} label="DB 사용량" sub={`${db.db_size_pretty} / 8GB (${dbPct}%)`} />
            <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)', marginTop: 'var(--sp-md)' }}>
              {[
                { label: '활성 커넥션', value: db.active_connections ?? 0, color: C.brand },
                { label: '캐시 히트율', value: `${db.cache_hit_ratio ?? 0}%`, color: C.green },
                { label: '총 행 수', value: typeof db.total_rows === 'number' ? db.total_rows.toLocaleString() : db.total_rows, color: C.purple },
                { label: '인덱스', value: db.index_size ?? '0', color: C.yellow },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {db.tables && (
              <details style={{ marginTop: 'var(--sp-md)' }}>
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.textSec }}>📊 테이블별 사용량 Top 15</summary>
                <div style={{ marginTop: 'var(--sp-sm)' }}>
                  {db.tables.map((t: any) => (
                    <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                      <span style={{ fontFamily: 'monospace', color: C.text }}>{t.name}</span>
                      <span style={{ color: C.textDim }}>{(t.rows ?? 0).toLocaleString()}행 · {t.size}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : <div style={{ color: C.textDim, fontSize: 12, padding: 16, textAlign: 'center' }}>DB 통계 없음</div>}
      </div>

      {/* Quick Links */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)' }}>
        {[
          { label: 'Supabase', href: `https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || 'tezftxakuwhsclarprlz'}`, icon: '⚡' },
          { label: 'Vercel', href: 'https://vercel.com/dashboard', icon: '▲' },
          { label: 'GitHub', href: 'https://github.com/wls9205-a11y/kadeora', icon: '🐙' },
          { label: 'GA4', href: 'https://analytics.google.com', icon: '📊' },
        ].map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{
            display: 'block', padding: 14, borderRadius: 'var(--radius-md)', textDecoration: 'none', textAlign: 'center',
            background: C.card, border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 'var(--fs-md)', marginBottom: 'var(--sp-xs)' }}>{l.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{l.label}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── 환경변수 탭 ──
function EnvTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/env-check').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color: C.red, padding: 40, textAlign: 'center' }}>로드 실패</div>;

  const renderVars = (vars: { key: string; set: boolean }[], title: string) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-md)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>{title}</div>
      {vars.map(v => (
        <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}08` }}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{v.key}</span>
          {v.set
            ? <Badge color={C.green}>✓ 설정됨</Badge>
            : <Badge color={C.red}>✗ 미설정</Badge>}
        </div>
      ))}
    </div>
  );

  const serverOk = (data.serverVars || []).filter((v: any) => v.set).length;
  const publicOk = (data.publicVars || []).filter((v: any) => v.set).length;
  const total = (data.serverVars?.length || 0) + (data.publicVars?.length || 0);
  const totalOk = serverOk + publicOk;

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${totalOk === total ? C.green : C.yellow}40`, borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-lg)', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: totalOk === total ? C.green : C.yellow }}>{totalOk}/{total}</div>
        <div style={{ fontSize: 12, color: C.textDim }}>환경변수 설정 완료</div>
      </div>
      {renderVars(data.serverVars || [], '🔐 서버 환경변수')}
      {renderVars(data.publicVars || [], '🌐 공개 환경변수')}
    </div>
  );
}

// ── 기능 플래그 탭 ──
function FlagsTab() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/feature-flags').then(r => r.json()).then(d => setFlags(d.flags || [])).finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
    await fetch('/api/admin/feature-flags', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled }),
    });
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {flags.length === 0 && <div style={{ color: C.textDim, textAlign: 'center', padding: 40 }}>등록된 기능 플래그 없음</div>}
      {flags.map(f => (
        <div key={f.key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--card-p) var(--sp-lg)',
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-sm)',
        }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.text }}>{f.key}</div>
            {f.description && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{f.description}</div>}
          </div>
          <button onClick={() => toggle(f.key, !f.enabled)} style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
            background: f.enabled ? C.green : C.border, transition: 'background .2s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
              left: f.enabled ? 25 : 3, transition: 'left .2s',
            }} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// 🚨 REPORTS & PAYMENTS
// ══════════════════════════════════════
