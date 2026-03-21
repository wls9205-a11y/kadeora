'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const CRON_DISPLAY: Record<string, string> = {
  'seed-posts': '시드 게시글',
  'crawl-apt-trade': '실거래가 수집',
  'crawl-apt-resale': '재매매 수집',
  'crawl-unsold-molit': '미분양 수집',
  'crawl-seoul-redev': '서울 재개발',
  'crawl-busan-redev': '부산 재개발',
  'crawl-gyeonggi-redev': '경기 재개발',
  'blog-apt-new': '블로그: 신규 분양',
  'blog-apt-landmark': '블로그: 랜드마크',
  'blog-redevelopment': '블로그: 재개발',
  'blog-seed-guide': '블로그: 가이드',
  'blog-monthly-theme': '블로그: 월별 테마',
  'stock-price': '주식 시세',
  'stock-daily-briefing': 'AI 일일 시황',
  'stock-theme-daily': '테마 자동 갱신',
  'exchange-rate': '환율 기록',
  'aggregate-trade-stats': '실거래가 집계',
  'blog-weekly-market': '블로그: 주간 시장 리뷰',
  'blog-monthly-market': '블로그: 월간 시장 리뷰',
};

export default function AdminAutomation() {
  const [cronStatus, setCronStatus] = useState<any[]>([]);
  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    Promise.all([
      // Latest status per cron: get recent logs grouped by cron_name
      sb.from('cron_logs').select('*').order('started_at', { ascending: false }).limit(200),
      sb.from('api_quotas').select('*'),
    ]).then(([logsRes, quotasRes]) => {
      const allLogs = logsRes.data || [];

      // Get latest per cron_name
      const latestMap = new Map<string, any>();
      for (const log of allLogs) {
        if (!latestMap.has(log.cron_name)) {
          latestMap.set(log.cron_name, log);
        }
      }

      // Calculate success rate per cron (last 10)
      const statusArr = Array.from(latestMap.entries()).map(([name, latest]) => {
        const recentLogs = allLogs.filter((l: any) => l.cron_name === name).slice(0, 10);
        const successCount = recentLogs.filter((l: any) => l.status === 'success').length;
        const successRate = recentLogs.length > 0 ? Math.round((successCount / recentLogs.length) * 100) : 0;
        return { name, latest, successRate, recentCount: recentLogs.length };
      });

      setCronStatus(statusArr);
      setCronLogs(allLogs.slice(0, 50));
      setQuotas(quotasRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>로딩 중...</div>;

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  return (
    <div>
      {/* Cron Status Cards */}
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>크론 상태</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cronStatus.map(cs => (
          <div key={cs.name} style={{
            ...cardStyle,
            borderLeft: `3px solid ${cs.latest.status === 'success' ? '#22c55e' : cs.latest.status === 'running' ? '#3b82f6' : '#ef4444'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                {CRON_DISPLAY[cs.name] || cs.name}
              </div>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: cs.latest.status === 'success' ? '#22c55e' : cs.latest.status === 'running' ? '#3b82f6' : '#ef4444',
              }} />
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
              마지막: {cs.latest.started_at ? timeAgo(cs.latest.started_at) : '-'}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
              <span>처리: {cs.latest.records_processed || 0}건</span>
              <span>성공률: {cs.successRate}%</span>
            </div>
            {cs.latest.duration_ms && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                소요: {(cs.latest.duration_ms / 1000).toFixed(1)}초
              </div>
            )}
          </div>
        ))}
      </div>

      {/* API Quotas */}
      {quotas.length > 0 && (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>API 할당량</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
            {quotas.map(q => {
              const dailyPct = q.daily_limit ? Math.round((q.daily_used / q.daily_limit) * 100) : 0;
              const monthlyPct = q.monthly_limit ? Math.round((q.monthly_used / q.monthly_limit) * 100) : 0;
              const barColor = (pct: number) => pct >= 90 ? '#ef4444' : pct >= 80 ? '#eab308' : '#22c55e';
              return (
                <div key={q.api_name} style={cardStyle}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>{q.api_name}</div>
                  {q.daily_limit && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                        <span>일일</span>
                        <span>{q.daily_used}/{q.daily_limit} ({dailyPct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(dailyPct, 100)}%`, borderRadius: 3, background: barColor(dailyPct), transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                  {q.monthly_limit && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                        <span>월간</span>
                        <span>{q.monthly_used}/{q.monthly_limit} ({monthlyPct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(monthlyPct, 100)}%`, borderRadius: 3, background: barColor(monthlyPct), transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Cron Log Table */}
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>크론 실행 로그</div>
      <div style={{ ...cardStyle, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>시간</th>
              <th style={{ padding: '8px 10px' }}>크론</th>
              <th style={{ padding: '8px 10px' }}>상태</th>
              <th style={{ padding: '8px 10px' }}>소요</th>
              <th style={{ padding: '8px 10px' }}>처리</th>
              <th style={{ padding: '8px 10px' }}>에러</th>
            </tr>
          </thead>
          <tbody>
            {cronLogs.map((log, i) => (
              <tr key={log.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {log.started_at ? new Date(log.started_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td style={{ padding: '8px 10px', color: '#1e293b', fontWeight: 600 }}>
                  {CRON_DISPLAY[log.cron_name] || log.cron_name}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                    background: log.status === 'success' ? '#dcfce7' : log.status === 'running' ? '#dbeafe' : '#fee2e2',
                    color: log.status === 'success' ? '#16a34a' : log.status === 'running' ? '#2563eb' : '#dc2626',
                  }}>{log.status}</span>
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b' }}>
                  {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-'}
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b' }}>
                  {log.records_processed || 0}
                </td>
                <td style={{ padding: '8px 10px', color: '#ef4444', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.error_message || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
