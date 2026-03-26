'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, KPI, KPICard, Pill, Spinner, ago } from '../admin-shared';

export default function SystemSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const load = useCallback((h = hours) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=system&hours=${h}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [hours]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  if (loading) return <Spinner />;

  const crons: any[] = data?.crons ?? [];
  const totalRuns = data?.totalRuns ?? 0;
  const successRate = totalRuns > 0 ? Math.round((crons.reduce((s, c) => s + c.success, 0) / totalRuns) * 100) : 100;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>⚙️ 시스템</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {[6, 12, 24, 48].map(h => <Pill key={h} active={hours === h} onClick={() => { setHours(h); load(h); }}>{h}시간</Pill>)}
        </div>
      </div>

      {/* Health Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard icon="🔄" label="총 실행" value={totalRuns} color={C.brand} />
        <KPICard icon="✅" label="성공률" value={`${successRate}%`} color={successRate >= 90 ? C.green : C.yellow} />
        <KPICard icon="❌" label="실패 크론" value={crons.filter(c => c.failed > 0).length} color={C.red} />
      </div>

      {/* Cron Table */}
      <DataTable
        headers={['크론', '실행', '성공', '실패', '평균시간', '마지막 실행', '상태', '에러']}
        rows={crons.map(c => [
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
    </div>
  );
}

// ══════════════════════════════════════
// 🚨 REPORTS & PAYMENTS
// ══════════════════════════════════════
