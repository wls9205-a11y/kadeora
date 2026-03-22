'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 12,
  padding: 20,
  border: '1px solid var(--border)',
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

  // 블로그 발행 설정
  const [blogConfig, setBlogConfig] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  useEffect(() => {
    const sb = createSupabaseBrowser();
    Promise.all([
      sb.from('cron_logs').select('*').order('started_at', { ascending: false }).limit(200),
      sb.from('api_quotas').select('*'),
      sb.from('blog_publish_config').select('*').eq('id', 1).single(),
      sb.rpc('blog_queue_status'),
    ]).then(([logsRes, quotasRes, configRes, queueRes]) => {
      const allLogs = logsRes.data || [];

      const latestMap = new Map<string, any>();
      for (const log of allLogs) {
        if (!latestMap.has(log.cron_name)) {
          latestMap.set(log.cron_name, log);
        }
      }

      const statusArr = Array.from(latestMap.entries()).map(([name, latest]) => {
        const recentLogs = allLogs.filter((l: any) => l.cron_name === name).slice(0, 10);
        const successCount = recentLogs.filter((l: any) => l.status === 'success').length;
        const successRate = recentLogs.length > 0 ? Math.round((successCount / recentLogs.length) * 100) : 0;
        return { name, latest, successRate, recentCount: recentLogs.length };
      });

      setCronStatus(statusArr);
      setCronLogs(allLogs.slice(0, 50));
      setQuotas(quotasRes.data || []);
      setBlogConfig(configRes.data);
      setQueueStatus(queueRes.data);
      setLoading(false);
    });
  }, []);

  const saveBlogConfig = async () => {
    if (!blogConfig) return;
    setConfigSaving(true);
    setConfigMsg('');
    const sb = createSupabaseBrowser();
    const { error } = await sb.from('blog_publish_config').update({
      daily_publish_limit: blogConfig.daily_publish_limit,
      daily_create_limit: blogConfig.daily_create_limit,
      min_content_length: blogConfig.min_content_length,
      title_similarity_threshold: blogConfig.title_similarity_threshold,
      auto_publish_enabled: blogConfig.auto_publish_enabled,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setConfigSaving(false);
    setConfigMsg(error ? `❌ ${error.message}` : '✅ 저장 완료');
    // 큐 상태 갱신
    const { data: qs } = await sb.rpc('blog_queue_status');
    if (qs) setQueueStatus(qs);
  };

  // 리라이팅
  const [rewriteStatus, setRewriteStatus] = useState<{ running: boolean; rewritten: number; total: number; log: string[] }>({ running: false, rewritten: 0, total: 0, log: [] });
  const [rewriteStats, setRewriteStats] = useState<{ total: number; done: number; remaining: number } | null>(null);

  useEffect(() => {
    if (!loading) {
      const sb = createSupabaseBrowser();
      Promise.all([
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).not('rewritten_at', 'is', null),
      ]).then(([totalR, doneR]) => {
        const total = totalR.count ?? 0;
        const done = doneR.count ?? 0;
        setRewriteStats({ total, done, remaining: total - done });
      });
    }
  }, [loading, rewriteStatus.rewritten]);

  const runRewrite = async (batchSize: number = 5) => {
    if (rewriteStatus.running) return;
    setRewriteStatus(prev => ({ ...prev, running: true, log: [...prev.log, '리라이팅 시작...'] }));
    try {
      const res = await fetch('/api/admin/blog-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize }),
      });
      const data = await res.json();
      setRewriteStatus(prev => ({
        running: false,
        rewritten: prev.rewritten + (data.rewritten || 0),
        total: prev.total + (data.total || 0),
        log: [...prev.log, `완료: ${data.rewritten}/${data.total}건 리라이팅`, ...(data.results || []).map((r: any) => `  ${r.slug}: ${r.status}`)],
      }));
    } catch (err: any) {
      setRewriteStatus(prev => ({ ...prev, running: false, log: [...prev.log, `에러: ${err.message}`] }));
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>;

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
      {/* 블로그 발행 설정 */}
      {blogConfig && (
        <>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>📰 블로그 발행 설정</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 24 }}>
            {/* 설정 카드 */}
            <div style={{ ...cardStyle, borderLeft: '3px solid #60A5FA' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>발행 제어</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={blogConfig.auto_publish_enabled} onChange={e => setBlogConfig({ ...blogConfig, auto_publish_enabled: e.target.checked })} />
                  자동 발행 활성화
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', minWidth: 100 }}>하루 발행 수</span>
                  <input type="number" min={1} max={50} value={blogConfig.daily_publish_limit} onChange={e => setBlogConfig({ ...blogConfig, daily_publish_limit: parseInt(e.target.value) || 3 })}
                    style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>개/일</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', minWidth: 100 }}>하루 생성 상한</span>
                  <input type="number" min={1} max={50} value={blogConfig.daily_create_limit} onChange={e => setBlogConfig({ ...blogConfig, daily_create_limit: parseInt(e.target.value) || 10 })}
                    style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>개/일</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', minWidth: 100 }}>최소 글자 수</span>
                  <input type="number" min={500} max={3000} step={100} value={blogConfig.min_content_length} onChange={e => setBlogConfig({ ...blogConfig, min_content_length: parseInt(e.target.value) || 1200 })}
                    style={{ width: 70, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>자</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', minWidth: 100 }}>유사도 임계값</span>
                  <input type="number" min={0.1} max={0.9} step={0.05} value={blogConfig.title_similarity_threshold} onChange={e => setBlogConfig({ ...blogConfig, title_similarity_threshold: parseFloat(e.target.value) || 0.4 })}
                    style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>(0.4 = 40%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button onClick={saveBlogConfig} disabled={configSaving}
                    style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', opacity: configSaving ? 0.6 : 1 }}>
                    {configSaving ? '저장 중...' : '설정 저장'}
                  </button>
                  {configMsg && <span style={{ fontSize: 'var(--fs-xs)' }}>{configMsg}</span>}
                </div>
              </div>
            </div>

            {/* 큐 상태 카드 */}
            {queueStatus && (
              <div style={{ ...cardStyle, borderLeft: '3px solid #34D399' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>발행 큐 현황</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ textAlign: 'center', padding: 10, background: 'var(--bg-hover)', borderRadius: 8 }}>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{queueStatus.published_today ?? 0}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>오늘 발행</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 10, background: 'var(--bg-hover)', borderRadius: 8 }}>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{queueStatus.remaining_today ?? 0}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>오늘 남은 쿼터</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 10, background: 'var(--bg-hover)', borderRadius: 8 }}>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-green)' }}>{queueStatus.queue_ready ?? 0}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>대기 중 (발행 가능)</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 10, background: 'var(--bg-hover)', borderRadius: 8 }}>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: queueStatus.queue_too_short > 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>{queueStatus.queue_too_short ?? 0}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>대기 중 (길이 미달)</div>
                  </div>
                </div>
                {queueStatus.queue_ready > 0 && (
                  <div style={{ marginTop: 10, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    현재 속도로 큐 소진까지 약 {Math.ceil((queueStatus.queue_ready) / (queueStatus.daily_limit || 3))}일
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 블로그 리라이팅 */}
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>✍️ AI 리라이팅</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ ...cardStyle, borderLeft: '3px solid #A78BFA' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Claude API 리라이팅</div>
          {rewriteStats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-hover)', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{rewriteStats.done}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>완료</div>
              </div>
              <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-hover)', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-purple)' }}>{rewriteStats.remaining}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>대기</div>
              </div>
              <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-hover)', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{rewriteStats.total}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전체</div>
              </div>
            </div>
          )}
          {rewriteStats && rewriteStats.total > 0 && (
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${Math.round((rewriteStats.done / rewriteStats.total) * 100)}%`, borderRadius: 3, background: 'var(--accent-purple)', transition: 'width 0.3s' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => runRewrite(5)} disabled={rewriteStatus.running}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-purple)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: rewriteStatus.running ? 0.6 : 1 }}>
              {rewriteStatus.running ? '처리 중...' : '5건 리라이팅'}
            </button>
            <button onClick={() => runRewrite(10)} disabled={rewriteStatus.running}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-purple)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: rewriteStatus.running ? 0.6 : 1 }}>
              10건
            </button>
          </div>
          {rewriteStatus.log.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 150, overflow: 'auto', fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', borderRadius: 8, padding: 8 }}>
              {rewriteStatus.log.slice(-10).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      </div>

      {/* Cron Status Cards */}
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>크론 상태</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cronStatus.map(cs => (
          <div key={cs.name} style={{
            ...cardStyle,
            borderLeft: `3px solid ${cs.latest.status === 'success' ? 'var(--accent-green)' : cs.latest.status === 'running' ? 'var(--accent-blue)' : 'var(--accent-red)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {CRON_DISPLAY[cs.name] || cs.name}
              </div>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: cs.latest.status === 'success' ? 'var(--accent-green)' : cs.latest.status === 'running' ? 'var(--accent-blue)' : 'var(--accent-red)',
              }} />
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
              마지막: {cs.latest.started_at ? timeAgo(cs.latest.started_at) : '-'}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              <span>처리: {cs.latest.records_processed || 0}건</span>
              <span>성공률: {cs.successRate}%</span>
            </div>
            {cs.latest.duration_ms && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                소요: {(cs.latest.duration_ms / 1000).toFixed(1)}초
              </div>
            )}
          </div>
        ))}
      </div>

      {/* API Quotas */}
      {quotas.length > 0 && (
        <>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>API 할당량</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
            {quotas.map(q => {
              const dailyPct = q.daily_limit ? Math.round((q.daily_used / q.daily_limit) * 100) : 0;
              const monthlyPct = q.monthly_limit ? Math.round((q.monthly_used / q.monthly_limit) * 100) : 0;
              const barColor = (pct: number) => pct >= 90 ? 'var(--accent-red)' : pct >= 80 ? 'var(--accent-yellow)' : 'var(--accent-green)';
              return (
                <div key={q.api_name} style={cardStyle}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{q.api_name}</div>
                  {q.daily_limit && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <span>일일</span>
                        <span>{q.daily_used}/{q.daily_limit} ({dailyPct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(dailyPct, 100)}%`, borderRadius: 3, background: barColor(dailyPct), transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                  {q.monthly_limit && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <span>월간</span>
                        <span>{q.monthly_used}/{q.monthly_limit} ({monthlyPct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
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
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>크론 실행 로그</div>
      <div style={{ ...cardStyle, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
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
              <tr key={log.id || i} style={{ borderBottom: '1px solid var(--bg-hover)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {log.started_at ? new Date(log.started_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {CRON_DISPLAY[log.cron_name] || log.cron_name}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                    background: log.status === 'success' ? 'rgba(52,211,153,0.12)' : log.status === 'running' ? 'rgba(96,165,250,0.12)' : 'rgba(248,113,113,0.12)',
                    color: log.status === 'success' ? '#059669' : log.status === 'running' ? '#2563eb' : 'var(--accent-red)',
                  }}>{log.status}</span>
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                  {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-'}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                  {log.records_processed || 0}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--accent-red)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
