'use client';
import { timeAgo as ago } from '@/lib/format';
import { useState, useEffect, useCallback } from 'react';


export default function OpsTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningCron, setRunningCron] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=ops').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (loading || !data || data.error) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { cronGroups, failedCrons, totalOk, totalFail, dbMb, recentCrons } = data;
  const totalCron = totalOk + totalFail;
  const successRate = totalCron > 0 ? Math.round((totalOk / totalCron) * 1000) / 10 : 100;
  const dbPct = dbMb ? Math.round((dbMb / 8192) * 1000) / 10 : 0;

  const runSingle = async (cronName: string) => {
    setRunningCron(cronName);
    try {
      const r = await fetch('/api/admin/trigger-cron', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronPath: `/api/cron/${cronName}` }),
      });
      const d = await r.json();
      alert(d.ok ? `✅ ${cronName} 실행 완료` : `❌ ${d.error || '실패'}`);
      load();
    } catch { alert('실행 실패'); }
    finally { setRunningCron(null); }
  };

  const groupLabels: Record<string, { icon: string; label: string }> = {
    data: { icon: '📡', label: '데이터 수집' },
    process: { icon: '⚙️', label: '데이터 처리' },
    ai: { icon: '🤖', label: 'AI 생성' },
    content: { icon: '✍️', label: '콘텐츠' },
    system: { icon: '🛠️', label: '시스템' },
    alert: { icon: '🔔', label: '알림' },
  };

  return (
    <div>
      {/* 크론 헬스 */}
      <div className="adm-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={successRate >= 95 ? '#10B981' : successRate >= 80 ? '#F59E0B' : '#EF4444'} strokeWidth="6"
                strokeDasharray={`${successRate * 2.14} 214`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: successRate >= 95 ? '#10B981' : '#F59E0B' }}>{successRate}%</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>크론 성공률 (24h)</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12 }}>
              <span style={{ color: '#10B981' }}>✓ {totalOk} 성공</span>
              <span style={{ color: totalFail > 0 ? '#EF4444' : 'var(--text-tertiary)' }}>✗ {totalFail} 실패</span>
            </div>
          </div>
        </div>
      </div>

      {/* 실패 크론 */}
      {Object.keys(failedCrons || {}).length > 0 && (
        <>
          <div className="adm-sec" style={{ color: '#EF4444' }}>🔴 실패 크론</div>
          {Object.entries(failedCrons || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([name, info]: [string, any]) => (
            <div key={name} className="adm-card" style={{ borderLeft: '3px solid #EF4444', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
                <span style={{ fontSize: 10, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4 }}>{info.count}회</span>
                <span style={{ flex: 1 }} />
                <button className="adm-btn" style={{ fontSize: 10, padding: '3px 8px' }}
                  onClick={() => runSingle(name)} disabled={runningCron === name}>
                  {runningCron === name ? '실행중...' : '재실행'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {info.lastError?.slice(0, 100) || '에러 메시지 없음'}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 크론 그룹 */}
      <div className="adm-sec">📊 크론 그룹별 현황</div>
      {Object.entries(cronGroups || {}).map(([key, g]: [string, any]) => {
        const info = groupLabels[key] || { icon: '📦', label: key };
        const total = g.ok + g.fail;
        const pct = total > 0 ? Math.round((g.ok / total) * 100) : 100;
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', marginBottom: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <span style={{ fontSize: 14 }}>{info.icon}</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', minWidth: 70 }}>{info.label}</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({g.cronCount})</span>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 90 ? '#10B981' : '#F59E0B', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
          </div>
        );
      })}

      {/* 최근 크론 실행 이력 */}
      <div className="adm-sec">🕐 최근 실행</div>
      <div className="adm-card" style={{ padding: '6px 14px' }}>
        {(recentCrons || []).map((c: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < (recentCrons?.length || 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.status === 'success' ? '#10B981' : '#EF4444', flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            {c.records > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{c.records}건</span>}
            {c.duration && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{c.duration}s</span>}
            <span style={{ color: 'var(--text-tertiary)', fontSize: 9, minWidth: 40, textAlign: 'right' }}>{ago(c.at)}</span>
          </div>
        ))}
      </div>

      {/* 시스템 리소스 */}
      <div className="adm-sec">💾 시스템 리소스</div>
      <div className="adm-card" style={{ padding: '12px 14px' }}>
        {/* DB */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 20 }}>DB</span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dbPct}%`, background: dbPct < 50 ? '#10B981' : dbPct < 80 ? '#F59E0B' : '#EF4444', borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 80, textAlign: 'right' }}>{dbMb ? `${(dbMb/1024).toFixed(1)}GB` : '?'} / 8GB</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          {dbPct}% 사용 · 여유 {dbMb ? `${((8192-dbMb)/1024).toFixed(1)}GB` : '?'}
        </div>

        {/* API 키 */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>API 키 상태</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            { name: 'CRON_SECRET', ok: true },
            { name: 'ANTHROPIC', ok: true },
            { name: 'STOCK_DATA', ok: true },
            { name: 'VAPID', ok: true },
            { name: 'KIS', ok: false },
            { name: 'APT_DATA', ok: false },
          ].map(k => (
            <span key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, fontSize: 9, background: k.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: k.ok ? '#10B981' : '#EF4444' }}>
              {k.ok ? '✓' : '✗'} {k.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
