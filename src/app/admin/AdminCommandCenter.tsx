'use client';
import { useState, useCallback } from 'react';
import AdminDashboard from './AdminDashboard';
import AdminAutomation from './AdminAutomation';
import AdminContent from './AdminContent';
import AdminUsers from './AdminUsers';

const TABS = [
  { id: 'dashboard', icon: '📊', label: '대시보드' },
  { id: 'automation', icon: '⚡', label: '자동화' },
  { id: 'content', icon: '📝', label: '콘텐츠' },
  { id: 'users', icon: '👥', label: '유저' },
] as const;

type TabId = typeof TABS[number]['id'];

const CRON_NAMES: Record<string, string> = {
  'health-check': '서비스 상태 체크',
  'stock-price': '주식 시세 갱신',
  'crawl-apt-trade': '실거래가 수집',
  'crawl-apt-resale': '재매매 데이터 수집',
  'crawl-unsold-molit': '미분양 데이터 수집',
  'crawl-seoul-redev': '서울 재개발 수집',
  'crawl-busan-redev': '부산 재개발 수집',
  'seed-posts': '시드 게시글 생성',
  'daily-stats': '일일 통계 캡처',
  'aggregate-trade-stats': '실거래가 집계',
  'exchange-rate': '환율 기록',
  'stock-theme-daily': '테마 자동 갱신',
  'stock-daily-briefing': 'AI 일일 시황',
  'blog-weekly-market': '블로그: 주간 시장 리뷰',
  'blog-monthly-market': '블로그: 월간 시장 리뷰',
};

interface RefreshState {
  running: boolean;
  current: string;
  results: { name: string; status: string }[];
  summary: { successCount: number; failCount: number } | null;
  elapsed: number;
}

export default function AdminCommandCenter({ healthChecks }: { healthChecks: { service_name: string; status: string }[] }) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [refresh, setRefresh] = useState<RefreshState>({
    running: false,
    current: '',
    results: [],
    summary: null,
    elapsed: 0,
  });

  const handleRefreshAll = useCallback(async () => {
    if (refresh.running) return;
    setRefresh({ running: true, current: '시작 중...', results: [], summary: null, elapsed: 0 });
    const start = Date.now();

    const interval = setInterval(() => {
      setRefresh(prev => ({ ...prev, elapsed: Date.now() - start }));
    }, 500);

    try {
      // Show progress for each cron
      const cronOrder = Object.keys(CRON_NAMES);
      let idx = 0;
      const progressInterval = setInterval(() => {
        if (idx < cronOrder.length) {
          setRefresh(prev => ({ ...prev, current: CRON_NAMES[cronOrder[idx]] || cronOrder[idx] }));
          idx++;
        }
      }, 3000);

      const res = await fetch('/api/admin/refresh-all', { method: 'POST' });
      clearInterval(progressInterval);

      if (res.ok) {
        const data = await res.json();
        setRefresh(prev => ({
          ...prev,
          running: false,
          current: '',
          results: data.results || [],
          summary: data.summary || null,
          elapsed: Date.now() - start,
        }));
      } else {
        setRefresh(prev => ({
          ...prev,
          running: false,
          current: '',
          summary: { successCount: 0, failCount: 1 },
          elapsed: Date.now() - start,
        }));
      }
    } catch {
      setRefresh(prev => ({
        ...prev,
        running: false,
        current: '',
        summary: { successCount: 0, failCount: 1 },
        elapsed: Date.now() - start,
      }));
    } finally {
      clearInterval(interval);
    }
  }, [refresh.running]);

  const statusDot = (status: string) => {
    const color = status === 'ok' ? '#22c55e' : status === 'warning' ? '#eab308' : '#ef4444';
    return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="admin-header" style={{
        background: '#0f172a',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: '#ff5b36' }}>카더라</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.4)' }}>커맨드센터</div>
        </div>

        {/* Service status dots */}
        <div className="service-dots" style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
          {healthChecks.map(hc => (
            <div key={hc.service_name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {statusDot(hc.status)}
              <span style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.5)' }}>{hc.service_name}</span>
            </div>
          ))}
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefreshAll}
          disabled={refresh.running}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: refresh.running ? '#334155' : '#ff5b36',
            color: '#fff',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            cursor: refresh.running ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {refresh.running ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {refresh.current}
            </>
          ) : '🔄 전체 갱신'}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Refresh result banner */}
      {refresh.summary && !refresh.running && (
        <div style={{
          padding: '10px 24px',
          background: refresh.summary.failCount > 0 ? '#fef2f2' : '#f0fdf4',
          borderBottom: `2px solid ${refresh.summary.failCount > 0 ? '#ef4444' : '#22c55e'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 'var(--fs-sm)',
        }}>
          <span style={{ fontWeight: 700, color: refresh.summary.failCount > 0 ? '#ef4444' : '#22c55e' }}>
            {refresh.summary.failCount > 0 ? '⚠️' : '✅'} 전체 갱신 완료
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            성공 {refresh.summary.successCount}개 / 실패 {refresh.summary.failCount}개 · {(refresh.elapsed / 1000).toFixed(1)}초
          </span>
          {refresh.results.filter(r => r.status !== 'success').length > 0 && (
            <span style={{ color: '#ef4444', fontSize: 'var(--fs-sm)' }}>
              실패: {refresh.results.filter(r => r.status !== 'success').map(r => CRON_NAMES[r.name] || r.name).join(', ')}
            </span>
          )}
          <button onClick={() => setRefresh(prev => ({ ...prev, summary: null }))} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)',
          }}>&times;</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: activeTab === tab.id ? '#ff5b36' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid #ff5b36' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="admin-content" style={{ padding: 24, maxWidth: 1200 }}>
        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'automation' && <AdminAutomation />}
        {activeTab === 'content' && <AdminContent />}
        {activeTab === 'users' && <AdminUsers />}
      </div>
    </div>
  );
}
