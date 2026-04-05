'use client';
import { useState, useEffect, useCallback } from 'react';

export default function OpsTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=ops').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (loading || !data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { cronGroups, failedCrons, totalOk, totalFail } = data;
  const totalCron = totalOk + totalFail;
  const successRate = totalCron > 0 ? Math.round((totalOk / totalCron) * 1000) / 10 : 100;

  const runSingle = async (cronName: string) => {
    try {
      const r = await fetch('/api/admin/trigger-cron', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronPath: `/api/cron/${cronName}` }),
      });
      const d = await r.json();
      alert(d.ok ? `✅ ${cronName} 실행 완료` : `❌ ${d.error || '실패'}`);
      load();
    } catch { alert('실행 실패'); }
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
      <div className="adm-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: successRate >= 95 ? '#10B981' : successRate >= 80 ? '#F59E0B' : '#EF4444' }}>
          {successRate}%
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          성공 {totalOk} · 실패 {totalFail} · 24시간
        </div>
        <div className="adm-bar" style={{ marginTop: 10 }}>
          <div className="adm-bar-fill" style={{ width: `${successRate}%`, background: successRate >= 95 ? '#10B981' : '#F59E0B' }} />
        </div>
      </div>

      {/* 실패 크론 */}
      {Object.keys(failedCrons || {}).length > 0 && (
        <>
          <div className="adm-sec" style={{ color: '#EF4444' }}>🔴 실패 크론</div>
          {Object.entries(failedCrons || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([name, info]: [string, any]) => (
            <div key={name} className="adm-card" style={{ borderLeft: '3px solid #EF4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
                <span style={{ fontSize: 10, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4 }}>{info.count}회</span>
                <span style={{ flex: 1 }} />
                <button className="adm-btn" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => runSingle(name)}>실행</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {info.lastError?.slice(0, 80) || '에러 메시지 없음'}
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
          <div key={key} className="adm-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{info.icon} {info.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({g.cronCount}개)</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444' }}>{pct}%</span>
            </div>
            <div className="adm-bar" style={{ marginBottom: 0 }}>
              <div className="adm-bar-fill" style={{ width: `${pct}%`, background: pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444' }} />
            </div>
          </div>
        );
      })}

      {/* 시스템 리소스 */}
      <div className="adm-sec">💾 시스템</div>
      <div className="adm-card">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>DB: 추정 1,852 / 8,192 MB</div>
          <div className="adm-bar"><div className="adm-bar-fill" style={{ width: '22.6%', background: 'var(--brand)' }} /></div>
          <div style={{ marginTop: 6 }}>
            API 키: ✅ CRON_SECRET · ✅ ANTHROPIC · ✅ STOCK_DATA · ❌ KIS · ❌ APT_DATA
          </div>
        </div>
      </div>
    </div>
  );
}
