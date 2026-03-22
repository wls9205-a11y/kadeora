'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 12,
  padding: 20,
  border: '1px solid var(--border)',
};

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [healthChecks, setHealthChecks] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [unsoldMonthly, setUnsoldMonthly] = useState<any[]>([]);
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      // KPI counts
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today),
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today),
      sb.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', today),
      sb.from('blog_posts').select('id', { count: 'exact', head: true }),
      sb.from('stock_quotes').select('id', { count: 'exact', head: true }),
      sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }),
      // Other data
      sb.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(20),
      sb.from('health_checks').select('*'),
      sb.from('daily_stats').select('*').order('stat_date', { ascending: false }).limit(7),
      sb.from('unsold_monthly_stats').select('stat_month, total_unsold').order('stat_month', { ascending: true }),
      sb.from('stock_daily_briefing').select('*').eq('market', 'KR').order('briefing_date', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([usersR, todayUsersR, postsR, todayPostsR, todayCommentsR, blogsR, stocksR, redevR, alertsRes, healthRes, statsRes, unsoldRes, briefingRes]) => {
      setData({
        total_users: usersR.count || 0,
        today_signups: todayUsersR.count || 0,
        total_posts: postsR.count || 0,
        today_posts: todayPostsR.count || 0,
        today_comments: todayCommentsR.count || 0,
        dau: todayUsersR.count || 0,
        total_blogs: blogsR.count || 0,
        total_stocks: stocksR.count || 0,
        total_apt_data: redevR.count || 0,
      });
      setAlerts(alertsRes.data || []);
      setHealthChecks(healthRes.data || []);
      setDailyStats((statsRes.data || []).reverse());
      setUnsoldMonthly(unsoldRes.data || []);
      setBriefing(briefingRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const markRead = async (id: number) => {
    const sb = createSupabaseBrowser();
    await sb.from('admin_alerts').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>;

  const d = data || {};
  const kpis = [
    { label: 'DAU', value: d.dau || 0, color: '#3b82f6', icon: '📊' },
    { label: '오늘 신규가입', value: d.today_signups || 0, color: '#10b981', icon: '🆕' },
    { label: '오늘 게시글', value: d.today_posts || 0, color: '#8b5cf6', icon: '📝' },
    { label: '오늘 댓글', value: d.today_comments || 0, color: '#f59e0b', icon: '💬' },
  ];

  const dataCounts = [
    { label: '전체 유저', value: d.total_users || 0, icon: '👥' },
    { label: '전체 게시글', value: d.total_posts || 0, icon: '📝' },
    { label: '블로그', value: d.total_blogs || 0, icon: '📰' },
    { label: '주식 종목', value: d.total_stocks || 0, icon: '📈' },
    { label: '부동산 데이터', value: d.total_apt_data || 0, icon: '🏠' },
  ];

  // Mini line chart SVG
  const renderMiniChart = (data: number[], label: string, color: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const w = 200, h = 60;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
          <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
          {data.map((v, i) => (
            <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - (v / max) * h} r="3" fill={color} />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 'var(--fs-2xl)', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: `${kpi.color}15` }}>{kpi.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{kpi.label}</div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Service Status */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>서비스 상태</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {healthChecks.map(hc => (
            <div key={hc.service_name} style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: hc.status === 'ok' ? 'rgba(34,197,94,0.1)' : hc.status === 'warning' ? 'rgba(234,179,8,0.1)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${hc.status === 'ok' ? 'rgba(34,197,94,0.3)' : hc.status === 'warning' ? 'rgba(234,179,8,0.3)' : 'rgba(248,113,113,0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--fs-sm)',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: hc.status === 'ok' ? '#22c55e' : hc.status === 'warning' ? '#eab308' : '#ef4444',
              }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{hc.service_name}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>{hc.response_time_ms}ms</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {dataCounts.map(dc => (
          <div key={dc.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)' }}>{dc.icon}</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>{(dc.value || 0).toLocaleString()}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{dc.label}</div>
          </div>
        ))}
      </div>

      {/* 7-day trend charts */}
      {dailyStats.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>7일 추이</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {renderMiniChart(dailyStats.map(s => s.signups || 0), '신규가입', '#3b82f6')}
            {renderMiniChart(dailyStats.map(s => s.posts || 0), '게시글', '#10b981')}
            {renderMiniChart(dailyStats.map(s => s.comments || 0), '댓글', '#8b5cf6')}
            {renderMiniChart(dailyStats.map(s => s.page_views || 0), '페이지뷰', '#f59e0b')}
          </div>
        </div>
      )}

      {/* Unsold Trend + Market Sentiment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {unsoldMonthly.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>미분양 추이</div>
            {(() => {
              const months = [...new Set(unsoldMonthly.map((s: any) => s.stat_month))].slice(-6);
              const data = months.map(m => {
                const total = unsoldMonthly.filter((s: any) => s.stat_month === m).reduce((sum: number, r: any) => sum + (r.total_unsold || 0), 0);
                return { label: String(m).slice(5), value: total };
              });
              const max = Math.max(...data.map(d => d.value), 1);
              const W = 240, H = 60, P = 4;
              const points = data.map((d, i) => `${P + (i / (data.length - 1)) * (W - P * 2)},${H - P - ((d.value / max) * (H - P * 2))}`).join(' ');
              return (
                <div>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60 }}>
                    <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    {data.map((d, i) => <circle key={i} cx={P + (i / (data.length - 1)) * (W - P * 2)} cy={H - P - ((d.value / max) * (H - P * 2))} r="3" fill="#3b82f6" />)}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {data.map(d => <span key={d.label}>{d.label}</span>)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {briefing && (
          <div style={cardStyle}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>시장 센티먼트</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>{briefing.sentiment === 'bullish' ? '🐂' : briefing.sentiment === 'bearish' ? '🐻' : '😐'}</span>
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)' }}>{briefing.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{briefing.briefing_date}</div>
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 10, fontWeight: 700,
                background: briefing.sentiment === 'bullish' ? '#dcfce7' : briefing.sentiment === 'bearish' ? '#fee2e2' : '#f1f5f9',
                color: briefing.sentiment === 'bullish' ? '#16a34a' : briefing.sentiment === 'bearish' ? '#dc2626' : '#64748b',
              }}>{briefing.sentiment === 'bullish' ? '강세' : briefing.sentiment === 'bearish' ? '약세' : '보합'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts Feed */}
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>최근 알림</div>
        {alerts.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', padding: 20, textAlign: 'center' }}>알림이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map(a => (
              <div key={a.id} style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: a.is_read ? 'var(--bg-base)' : a.severity === 'error' ? 'rgba(248,113,113,0.1)' : a.severity === 'warning' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${a.is_read ? 'var(--border)' : a.severity === 'error' ? 'rgba(248,113,113,0.3)' : a.severity === 'warning' ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: a.is_read ? 0.6 : 1,
                cursor: a.is_read ? 'default' : 'pointer',
              }} onClick={() => !a.is_read && markRead(a.id)}>
                <span style={{ fontSize: 'var(--fs-base)' }}>
                  {a.severity === 'error' ? '🔴' : a.severity === 'warning' ? '🟡' : '🟢'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: a.is_read ? 400 : 700, color: 'var(--text-primary)' }}>{a.title}</div>
                  {a.message && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{a.message}</div>}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
