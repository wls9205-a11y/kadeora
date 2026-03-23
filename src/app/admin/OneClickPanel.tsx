'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, Database, FileText, Settings, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface BatchResult {
  endpoint: string;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  message?: string;
}

interface Preset {
  key: string;
  label: string;
  count: number;
}

interface DiagnosticItem {
  label: string;
  status: 'ok' | 'warn' | 'error';
  value: string;
}

const PRESET_ICONS: Record<string, any> = {
  'full-refresh': Zap,
  'all-data': Database,
  'all-content': FileText,
  'system-maintenance': Settings,
};
const PRESET_COLORS: Record<string, string> = {
  'full-refresh': '#2563EB',
  'all-data': 'var(--accent-green)',
  'all-content': 'var(--accent-purple)',
  'system-maintenance': 'var(--accent-yellow)',
};

export default function OneClickPanel() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; success: number; failed: number; duration: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [diagLoading, setDiagLoading] = useState(true);

  // 프리셋 목록 로드
  useEffect(() => {
    fetch('/api/admin/batch-ops').then(r => r.json()).then(d => setPresets(d.presets || [])).catch(() => {});
  }, []);

  // 자동 진단
  const runDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    const items: DiagnosticItem[] = [];
    try {
      const sb = (await import('@/lib/supabase-browser')).createSupabaseBrowser();

      // 크론 상태
      const { data: cronLogs } = await sb.from('cron_logs')
        .select('cron_name, status, created_at')
        .order('created_at', { ascending: false }).limit(100);
      const recentFails = (cronLogs || []).filter((l: any) => l.status === 'failed' && Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000);
      items.push({
        label: '크론 (24시간)',
        status: recentFails.length === 0 ? 'ok' : recentFails.length < 3 ? 'warn' : 'error',
        value: recentFails.length === 0 ? '정상' : `${recentFails.length}건 실패`,
      });

      // 데이터 신선도
      const { data: latestTrade } = await sb.from('apt_transactions')
        .select('created_at').order('created_at', { ascending: false }).limit(1).single() as { data: any };
      const tradeAge = latestTrade ? Math.floor((Date.now() - new Date(latestTrade.created_at).getTime()) / 3600000) : 999;
      items.push({
        label: '실거래 데이터',
        status: tradeAge < 24 ? 'ok' : tradeAge < 72 ? 'warn' : 'error',
        value: tradeAge < 24 ? `${tradeAge}시간 전 갱신` : `${Math.floor(tradeAge / 24)}일 전`,
      });

      // 블로그 발행 큐
      const { count: queueCount } = await sb.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', false);
      items.push({
        label: '블로그 발행 큐',
        status: (queueCount || 0) < 50 ? 'ok' : (queueCount || 0) < 200 ? 'warn' : 'error',
        value: `${queueCount || 0}건 대기`,
      });

      // 유저 수
      const { count: userCount } = await sb.from('profiles')
        .select('id', { count: 'exact', head: true });
      items.push({ label: '가입자', status: 'ok', value: `${userCount || 0}명` });

      // 미처리 신고
      const { count: reportCount } = await sb.from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending') as any;
      items.push({
        label: '미처리 신고',
        status: (reportCount || 0) === 0 ? 'ok' : (reportCount || 0) < 5 ? 'warn' : 'error',
        value: (reportCount || 0) === 0 ? '없음' : `${reportCount}건`,
      });

    } catch { }
    setDiagnostics(items);
    setDiagLoading(false);
  }, []);

  useEffect(() => { runDiagnostics(); }, [runDiagnostics]);

  // 배치 실행
  const runBatch = async (presetKey: string) => {
    if (running) return;
    setRunning(presetKey);
    setResults([]);
    setSummary(null);
    try {
      const res = await fetch('/api/admin/batch-ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: presetKey }),
      });
      const data = await res.json();
      setResults(data.results || []);
      setSummary({ total: data.total, success: data.success, failed: data.failed, duration: data.duration });
    } catch { }
    setRunning(null);
    // 진단 갱신
    setTimeout(runDiagnostics, 2000);
  };

  const hasIssues = diagnostics.some(d => d.status !== 'ok');
  const errorCount = diagnostics.filter(d => d.status === 'error').length;
  const warnCount = diagnostics.filter(d => d.status === 'warn').length;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* 진단 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderRadius: '12px 12px 0 0',
        background: hasIssues ? (errorCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)') : 'rgba(52,211,153,0.1)',
        border: `1px solid ${hasIssues ? (errorCount > 0 ? 'var(--accent-red)' : 'var(--accent-yellow)') : 'var(--accent-green)'}`,
        borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {diagLoading ? <Clock size={18} /> :
            hasIssues ? <AlertTriangle size={18} color={errorCount > 0 ? 'var(--accent-red)' : 'var(--accent-yellow)'} /> :
            <CheckCircle size={18} color="var(--accent-green)" />}
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {diagLoading ? '진단 중...' : hasIssues ? `이슈 ${errorCount + warnCount}건 감지` : '✅ 시스템 정상'}
          </span>
        </div>
        <button onClick={runDiagnostics} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* 진단 항목 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 0,
        border: '1px solid var(--border)', borderTop: 'none',
      }}>
        {diagnostics.map((d, i) => (
          <div key={i} style={{
            padding: '10px 14px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
            background: d.status === 'error' ? 'rgba(239,68,68,0.05)' : d.status === 'warn' ? 'rgba(251,191,36,0.05)' : 'transparent',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{d.label}</div>
            <div style={{
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              color: d.status === 'error' ? 'var(--accent-red)' : d.status === 'warn' ? 'var(--accent-yellow)' : 'var(--accent-green)',
            }}>
              {d.value}
            </div>
          </div>
        ))}
      </div>

      {/* 원클릭 버튼 그리드 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8,
        marginTop: 12,
      }}>
        {presets.map(p => {
          const Icon = PRESET_ICONS[p.key] || Zap;
          const color = PRESET_COLORS[p.key] || '#2563EB';
          const isRunning = running === p.key;
          return (
            <button key={p.key} onClick={() => runBatch(p.key)} disabled={!!running} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
              borderRadius: 12, border: `1.5px solid ${isRunning ? color : 'var(--border)'}`,
              background: isRunning ? `${color}10` : 'var(--bg-surface)',
              cursor: running ? 'not-allowed' : 'pointer', textAlign: 'left',
              opacity: running && !isRunning ? 0.5 : 1,
              transition: 'all 0.15s',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${color}15`, flexShrink: 0,
              }}>
                {isRunning ? (
                  <RefreshCw size={18} color={color} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Icon size={18} color={color} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isRunning ? '실행 중...' : p.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.count}개 작업</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 실행 결과 */}
      {summary && (
        <div style={{
          marginTop: 12, padding: 14, borderRadius: 12,
          background: summary.failed === 0 ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${summary.failed === 0 ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {summary.failed === 0 ? '✅ 전체 성공' : `⚠️ ${summary.failed}건 실패`}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              {summary.success}/{summary.total} 성공 · {(summary.duration / 1000).toFixed(1)}초
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {results.map((r, i) => {
              const name = r.endpoint.split('/').pop() || r.endpoint;
              return (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: r.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
                  color: r.status === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontWeight: 600,
                }}>
                  {r.status === 'success' ? '✓' : '✗'} {name} ({(r.duration / 1000).toFixed(1)}s)
                </span>
              );
            })}
          </div>
        </div>
      )}

      {running && (
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      )}
    </div>
  );
}
