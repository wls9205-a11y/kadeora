'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [healthChecks, setHealthChecks] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    Promise.all([
      sb.rpc('get_admin_dashboard'),
      sb.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(20),
      sb.from('health_checks').select('*'),
      sb.from('daily_stats').select('*').order('stat_date', { ascending: false }).limit(7),
    ]).then(([dashRes, alertsRes, healthRes, statsRes]) => {
      setData(dashRes.data);
      setAlerts(alertsRes.data || []);
      setHealthChecks(healthRes.data || []);
      setDailyStats((statsRes.data || []).reverse());
      setLoading(false);
    });
  }, []);

  const markRead = async (id: number) => {
    const sb = createSupabaseBrowser();
    await sb.from('admin_alerts').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>로딩 중...</div>;

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
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
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
            <span style={{ fontSize: 24, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: `${kpi.color}15` }}>{kpi.icon}</span>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{kpi.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{kpi.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Service Status */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>서비스 상태</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {healthChecks.map(hc => (
            <div key={hc.service_name} style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: hc.status === 'ok' ? '#f0fdf4' : hc.status === 'warning' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${hc.status === 'ok' ? '#bbf7d0' : hc.status === 'warning' ? '#fde68a' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: hc.status === 'ok' ? '#22c55e' : hc.status === 'warning' ? '#eab308' : '#ef4444',
              }} />
              <div>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{hc.service_name}</div>
                <div style={{ color: '#94a3b8', fontSize: 10 }}>{hc.response_time_ms}ms</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {dataCounts.map(dc => (
          <div key={dc.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>{dc.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>{(dc.value || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{dc.label}</div>
          </div>
        ))}
      </div>

      {/* 7-day trend charts */}
      {dailyStats.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>7일 추이</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {renderMiniChart(dailyStats.map(s => s.signups || 0), '신규가입', '#3b82f6')}
            {renderMiniChart(dailyStats.map(s => s.posts || 0), '게시글', '#10b981')}
            {renderMiniChart(dailyStats.map(s => s.comments || 0), '댓글', '#8b5cf6')}
            {renderMiniChart(dailyStats.map(s => s.page_views || 0), '페이지뷰', '#f59e0b')}
          </div>
        </div>
      )}

      {/* Alerts Feed */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>최근 알림</div>
        {alerts.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, padding: 20, textAlign: 'center' }}>알림이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map(a => (
              <div key={a.id} style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: a.is_read ? '#f8fafc' : a.severity === 'error' ? '#fef2f2' : a.severity === 'warning' ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${a.is_read ? '#e2e8f0' : a.severity === 'error' ? '#fecaca' : a.severity === 'warning' ? '#fde68a' : '#bbf7d0'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: a.is_read ? 0.6 : 1,
                cursor: a.is_read ? 'default' : 'pointer',
              }} onClick={() => !a.is_read && markRead(a.id)}>
                <span style={{ fontSize: 14 }}>
                  {a.severity === 'error' ? '🔴' : a.severity === 'warning' ? '🟡' : '🟢'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: a.is_read ? 400 : 700, color: '#1e293b' }}>{a.title}</div>
                  {a.message && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{a.message}</div>}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
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
