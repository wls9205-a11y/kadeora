'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface CronSummary {
  cron_name: string; total_runs: number; success_count: number;
  error_count: number; avg_duration_ms: number; last_run: string; last_status: string;
}

function timeAgo(d: string) {
  if (!d) return '-';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function CronDashboard() {
  const [data, setData] = useState<CronSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cron-summary?hours=${hours}`);
      const d = await res.json();
      setData(d.summary || []);
    } catch { }
    setLoading(false);
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const totalRuns = data.reduce((s, d) => s + d.total_runs, 0);
  const totalErrors = data.reduce((s, d) => s + d.error_count, 0);
  const successRate = totalRuns > 0 ? ((totalRuns - totalErrors) / totalRuns * 100).toFixed(1) : '100';
  const failedCrons = data.filter(d => d.last_status === 'failed');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>⚙️ 크론 모니터링</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)',
          }}>
            <option value={6}>6시간</option>
            <option value={24}>24시간</option>
            <option value={72}>3일</option>
            <option value={168}>7일</option>
          </select>
          <button onClick={load} style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-surface)', cursor: 'pointer', color: 'var(--text-secondary)',
          }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>크론 수</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)' }}>{data.length}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>총 실행</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--accent-blue)' }}>{totalRuns}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>성공률</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: Number(successRate) >= 95 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{successRate}%</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>실패</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: totalErrors > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{totalErrors}</div>
        </div>
      </div>

      {/* 실패 알림 */}
      {failedCrons.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)',
          borderRadius: 10, padding: 12, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <AlertTriangle size={14} color="var(--accent-red)" />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>최근 실패 크론</span>
          </div>
          {failedCrons.map(c => (
            <div key={c.cron_name} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', padding: '2px 0' }}>
              {c.cron_name} — {c.error_count}회 실패 · 마지막: {timeAgo(c.last_run)}
            </div>
          ))}
        </div>
      )}

      {/* 크론 테이블 */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600 }}>크론</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>상태</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>실행</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>성공</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>실패</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 600 }}>평균ms</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 600 }}>마지막</th>
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.cron_name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.cron_name}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    {c.last_status === 'success' ? <CheckCircle size={14} color="var(--accent-green)" /> :
                     c.last_status === 'failed' ? <XCircle size={14} color="var(--accent-red)" /> :
                     <Clock size={14} color="var(--text-tertiary)" />}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{c.total_runs}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--accent-green)' }}>{c.success_count}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: c.error_count > 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>{c.error_count}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{c.avg_duration_ms ? Math.round(c.avg_duration_ms) : '-'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{timeAgo(c.last_run)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
