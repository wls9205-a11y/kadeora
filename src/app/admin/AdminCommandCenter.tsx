'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/* ─────────────────────── Types ─────────────────────── */
interface KPI { label: string; value: number; icon: string; color: string }
interface CronEntry { name: string; display: string; group: string; latest?: any; successRate: number }
interface RefreshState { running: boolean; current: string; done: number; total: number; results: { name: string; status: string }[]; elapsed: number }

/* ─────────────────────── Constants ─────────────────────── */
const CRON_MAP: Record<string, { display: string; group: string }> = {
  'health-check':          { display: '헬스체크',         group: '시스템' },
  'daily-stats':           { display: '일일 통계',        group: '시스템' },
  'seed-posts':            { display: '시드 게시글',      group: '콘텐츠' },
  'seed-comments':         { display: '시드 댓글',        group: '콘텐츠' },
  'seed-chat':             { display: '시드 채팅',        group: '콘텐츠' },
  'stock-price':           { display: '주식 시세',        group: '주식' },
  'stock-theme-daily':     { display: '테마 갱신',        group: '주식' },
  'stock-daily-briefing':  { display: 'AI 시황',          group: '주식' },
  'exchange-rate':         { display: '환율 기록',        group: '주식' },
  'crawl-apt-trade':       { display: '실거래 수집',      group: '부동산' },
  'crawl-apt-resale':      { display: '재매매 수집',      group: '부동산' },
  'crawl-apt-subscription':{ display: '청약 수집',        group: '부동산' },
  'crawl-competition-rate':{ display: '경쟁률 수집',      group: '부동산' },
  'crawl-unsold-molit':    { display: '미분양 수집',      group: '부동산' },
  'crawl-seoul-redev':     { display: '서울 재개발',      group: '부동산' },
  'crawl-busan-redev':     { display: '부산 재개발',      group: '부동산' },
  'crawl-gyeonggi-redev':  { display: '경기 재개발',      group: '부동산' },
  'crawl-nationwide-redev': { display: '전국 재개발',     group: '부동산' },
  'aggregate-trade-stats': { display: '거래 집계',        group: '부동산' },
  'blog-daily':            { display: '블로그 자동발행',   group: '블로그' },
  'blog-publish-queue':    { display: '발행 큐 처리',     group: '블로그' },
  'blog-rewrite':          { display: 'AI 리라이팅',      group: '블로그' },
  'blog-weekly-market':    { display: '주간 시장 리뷰',   group: '블로그' },
  'blog-monthly-market':   { display: '월간 시장 리뷰',   group: '블로그' },
  'blog-apt-new':          { display: '신규 분양 블로그',  group: '블로그' },
  'blog-apt-landmark':     { display: '랜드마크 블로그',   group: '블로그' },
  'blog-redevelopment':    { display: '재개발 블로그',    group: '블로그' },
  'blog-seed-guide':       { display: '가이드 블로그',    group: '블로그' },
  'blog-monthly-theme':    { display: '월별 테마 블로그',  group: '블로그' },
  'auto-grade':            { display: '등급 자동 갱신',    group: '시스템' },
};

const QUICK_ACTIONS = [
  { id: 'seed-posts',    label: '시드 게시글',  path: '/api/cron/seed-posts',    icon: '📝' },
  { id: 'seed-comments', label: '시드 댓글',    path: '/api/cron/seed-comments', icon: '💬' },
  { id: 'stock-refresh', label: '주식 시세',    path: '/api/stock-refresh',      icon: '📈' },
  { id: 'exchange-rate', label: '환율 기록',    path: '/api/cron/exchange-rate',  icon: '💱' },
  { id: 'apt-sub',       label: '청약 수집',    path: '/api/cron/crawl-apt-subscription', icon: '🏠' },
  { id: 'daily-stats',   label: '일일 통계',    path: '/api/cron/daily-stats',   icon: '📊' },
  { id: 'blog-daily',    label: '블로그 발행',  path: '/api/cron/blog-daily',    icon: '📰' },
  { id: 'health-check',  label: '헬스체크',     path: '/api/cron/health-check',  icon: '🩺' },
];

const GROUPS_ORDER = ['시스템', '주식', '부동산', '콘텐츠', '블로그'];
const GROUP_COLORS: Record<string, string> = {
  '시스템': '#7D8DA3', '주식': '#FBBF24', '부동산': '#60A5FA', '콘텐츠': '#34D399', '블로그': '#A78BFA',
};

/* ─────────────────────── Component ─────────────────────── */
export default function AdminCommandCenter({ healthChecks }: { healthChecks: { service_name: string; status: string }[] }) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [dataCounts, setDataCounts] = useState<{ label: string; value: number; icon: string }[]>([]);
  const [cronEntries, setCronEntries] = useState<CronEntry[]>([]);
  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [blogConfig, setBlogConfig] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [rewriteStats, setRewriteStats] = useState<{ total: number; done: number } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [refresh, setRefresh] = useState<RefreshState>({ running: false, current: '', done: 0, total: 0, results: [], elapsed: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [rewriteRunning, setRewriteRunning] = useState(false);
  const [rewriteLog, setRewriteLog] = useState<string[]>([]);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState('');
  const [noticeSaving, setNoticeSaving] = useState(false);

  const toggle = (id: string) => setExpandedPanel(prev => prev === id ? null : id);

  /* ─── Load All Data ─── */
  const loadAll = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const today = new Date().toISOString().slice(0, 10);

    try {
      const [
        usersR, todayUsersR, postsR, todayPostsR, todayCommentsR,
        blogsR, stocksR, redevR, dauR, aptSubR, aptTradeR, unsoldR,
        alertsRes, logsRes, quotasRes, statsRes,
        configRes, queueRes,
        rewriteTotalR, rewriteDoneR,
        usersListRes, reportsRes,
      ] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today),
        sb.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', today),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }),
        sb.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', today),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
        sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }),
        sb.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(15),
        sb.from('cron_logs').select('*').order('started_at', { ascending: false }).limit(300),
        sb.from('api_quotas').select('*'),
        sb.from('daily_stats').select('*').order('stat_date', { ascending: false }).limit(7),
        sb.from('blog_publish_config').select('*').eq('id', 1).single(),
        sb.rpc('blog_queue_status'),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).not('rewritten_at', 'is', null),
        sb.from('profiles').select('id, nickname, grade_title, created_at, is_deleted, points').order('created_at', { ascending: false }).limit(200),
        sb.from('reports').select('id, reason, content_type, status, auto_hidden, created_at').order('created_at', { ascending: false }).limit(20),
      ]);

      setKpis([
        { label: 'DAU (페이지뷰)', value: dauR.count || 0, icon: '👁', color: '#60A5FA' },
        { label: '오늘 가입', value: todayUsersR.count || 0, icon: '🆕', color: '#34D399' },
        { label: '오늘 게시글', value: todayPostsR.count || 0, icon: '📝', color: '#A78BFA' },
        { label: '오늘 댓글', value: todayCommentsR.count || 0, icon: '💬', color: '#FBBF24' },
      ]);

      setDataCounts([
        { label: '유저', value: usersR.count || 0, icon: '👥' },
        { label: '게시글', value: postsR.count || 0, icon: '📝' },
        { label: '블로그', value: blogsR.count || 0, icon: '📰' },
        { label: '주식', value: stocksR.count || 0, icon: '📈' },
        { label: '청약', value: aptSubR.count || 0, icon: '🏠' },
        { label: '실거래', value: aptTradeR.count || 0, icon: '🏗' },
        { label: '재개발', value: redevR.count || 0, icon: '🔨' },
        { label: '미분양', value: unsoldR.count || 0, icon: '📉' },
      ]);

      const allLogs = logsRes.data || [];
      const latestMap = new Map<string, any>();
      for (const log of allLogs) {
        if (!latestMap.has(log.cron_name)) latestMap.set(log.cron_name, log);
      }
      const entries: CronEntry[] = Array.from(latestMap.entries()).map(([name, latest]) => {
        const recentLogs = allLogs.filter((l: any) => l.cron_name === name).slice(0, 10);
        const sc = recentLogs.filter((l: any) => l.status === 'success').length;
        const info = CRON_MAP[name] || { display: name, group: '기타' };
        return { name, display: info.display, group: info.group, latest, successRate: recentLogs.length > 0 ? Math.round((sc / recentLogs.length) * 100) : 0 };
      });
      setCronEntries(entries);
      setCronLogs(allLogs.slice(0, 30));
      setAlerts(alertsRes.data || []);
      setQuotas(quotasRes.data || []);
      setDailyStats((statsRes.data || []).reverse());
      setBlogConfig(configRes.data);
      setQueueStatus(queueRes.data);
      setRewriteStats({ total: rewriteTotalR.count ?? 0, done: rewriteDoneR.count ?? 0 });
      setUsers(usersListRes.data || []);
      setReports(reportsRes.data || []);
      setLastRefresh(new Date());
    } catch (e) { console.error('Admin load error', e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ─── Quick Action ─── */
  const runQuickAction = async (action: typeof QUICK_ACTIONS[number]) => {
    if (actionRunning) return;
    setActionRunning(action.id);
    setActionResults(prev => ({ ...prev, [action.id]: { ok: true, msg: '실행 중...' } }));
    try {
      const res = await fetch(action.path, { headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` } });
      setActionResults(prev => ({ ...prev, [action.id]: { ok: res.ok, msg: res.ok ? '✓ 완료' : `✗ ${res.status}` } }));
      if (res.ok) setTimeout(() => loadAll(), 1000);
    } catch { setActionResults(prev => ({ ...prev, [action.id]: { ok: false, msg: '✗ 에러' } })); }
    setActionRunning(null);
    setTimeout(() => setActionResults(prev => { const n = { ...prev }; delete n[action.id]; return n; }), 4000);
  };

  /* ─── Refresh All ─── */
  const handleRefreshAll = useCallback(async () => {
    if (refresh.running) return;
    setRefresh({ running: true, current: '시작 중...', done: 0, total: Object.keys(CRON_MAP).length, results: [], elapsed: 0 });
    const start = Date.now();
    timerRef.current = setInterval(() => setRefresh(prev => ({ ...prev, elapsed: Date.now() - start })), 300);
    try {
      const res = await fetch('/api/admin/refresh-all', { method: 'POST' });
      const data = await res.json();
      setRefresh(prev => ({ ...prev, running: false, current: '', done: data.results?.length || 0, results: data.results || [], elapsed: Date.now() - start }));
      setTimeout(() => loadAll(), 500);
    } catch { setRefresh(prev => ({ ...prev, running: false, current: '에러 발생', elapsed: Date.now() - start })); }
    finally { if (timerRef.current) clearInterval(timerRef.current); }
  }, [refresh.running, loadAll]);

  /* ─── Blog Config Save ─── */
  const saveBlogConfig = async () => {
    if (!blogConfig) return;
    setConfigSaving(true); setConfigMsg('');
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
    setConfigMsg(error ? `❌ ${error.message}` : '✅ 저장됨');
    const { data: qs } = await sb.rpc('blog_queue_status');
    if (qs) setQueueStatus(qs);
    setTimeout(() => setConfigMsg(''), 3000);
  };

  /* ─── Rewrite ─── */
  const runRewrite = async (n: number) => {
    if (rewriteRunning) return;
    setRewriteRunning(true);
    setRewriteLog(prev => [...prev, `${n}건 리라이팅 시작...`]);
    try {
      const res = await fetch('/api/admin/blog-rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchSize: n }) });
      const data = await res.json();
      setRewriteLog(prev => [...prev, `완료: ${data.rewritten || 0}/${data.total || 0}건`]);
      const sb = createSupabaseBrowser();
      const [tR, dR] = await Promise.all([
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).not('rewritten_at', 'is', null),
      ]);
      setRewriteStats({ total: tR.count ?? 0, done: dR.count ?? 0 });
    } catch (err: any) { setRewriteLog(prev => [...prev, `에러: ${err.message}`]); }
    setRewriteRunning(false);
  };

  /* ─── Notice ─── */
  const postNotice = async () => {
    if (!noticeText.trim()) return;
    setNoticeSaving(true);
    const sb = createSupabaseBrowser();
    await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
    await sb.from('site_notices').insert({ content: noticeText.trim(), is_active: true });
    setNoticeText(''); setNoticeSaving(false);
  };

  /* ─── Alert dismiss ─── */
  const dismissAlert = async (id: number) => {
    const sb = createSupabaseBrowser();
    await sb.from('admin_alerts').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  /* ─── Helpers ─── */
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };
  const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

  /* ─── Mini Chart ─── */
  const MiniChart = ({ data, color, h = 40 }: { data: number[]; color: string; h?: number }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const w = 120;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4)}`).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }}>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`${color}15`} />
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
      </svg>
    );
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B1426', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(37,99,235,0.2)', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600 }}>커맨드센터 로딩 중...</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const successCrons = cronEntries.filter(c => c.latest?.status === 'success').length;
  const failCrons = cronEntries.filter(c => c.latest?.status === 'error' || c.latest?.status === 'failed').length;
  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const unreadAlerts = alerts.filter(a => !a.is_read).length;
  const realUsers = users.filter(u => !u.id.startsWith('aaaaaaaa'));

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', background: '#0B1426', color: 'var(--text-primary)' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .cc-card{transition:border-color .2s,box-shadow .2s}
        .cc-card:hover{border-color:rgba(37,99,235,0.25)}
        .cc-btn{padding:7px 14px;border-radius:8px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px}
        .cc-btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
        .cc-btn:active{transform:translateY(0)}
        .cc-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;filter:none}
        .cc-input{padding:5px 10px;border-radius:6px;border:1px solid #1E3050;background:#0F1D35;color:#e2e8f0;font-size:13px;width:55px;outline:none;transition:border-color .2s}
        .cc-input:focus{border-color:#2563EB}
        .cc-section{animation:fadein .3s ease}
        .cc-progress{height:4px;border-radius:2px;background:#1E3050;overflow:hidden}
        .cc-progress-bar{height:100%;border-radius:2px;transition:width .5s ease}
        .cc-scrollbar::-webkit-scrollbar{width:4px}
        .cc-scrollbar::-webkit-scrollbar-thumb{background:#2A4060;border-radius:2px}
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ background: 'linear-gradient(180deg,#0F1D35 0%,#0B1426 100%)', borderBottom: '1px solid #1E3050', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#2563EB', letterSpacing: -0.5 }}>카더라</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#7D8DA3', letterSpacing: 1 }}>COMMAND CENTER</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 }}>
            {healthChecks.map(hc => (
              <div key={hc.service_name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hc.status === 'ok' ? '#34D399' : hc.status === 'warning' ? '#FBBF24' : '#F87171', animation: hc.status !== 'ok' ? 'pulse-dot 1.5s infinite' : 'none' }} />
                <span style={{ fontSize: 10, color: '#7D8DA3' }}>{hc.service_name}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: failCrons > 0 ? '#F87171' : '#34D399' }} />
              <span style={{ fontSize: 10, color: '#7D8DA3' }}>크론 {successCrons}/{cronEntries.length}</span>
            </div>
            {pendingReports > 0 && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(248,113,113,0.12)', color: '#F87171', fontWeight: 700 }}>신고 {pendingReports}</span>}
            {unreadAlerts > 0 && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(251,191,36,0.12)', color: '#FBBF24', fontWeight: 700 }}>알림 {unreadAlerts}</span>}
          </div>
          {lastRefresh && <span style={{ fontSize: 10, color: '#7D8DA3' }}>갱신: {lastRefresh.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button className="cc-btn" onClick={handleRefreshAll} disabled={refresh.running} style={{ background: refresh.running ? '#1E3050' : '#2563EB', color: '#fff', padding: '8px 16px' }}>
            {refresh.running ? (<><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />{((refresh.elapsed/1000)|0)}초</>) : '⚡ 전체 갱신'}
          </button>
          <button className="cc-btn" onClick={() => { setLoading(true); loadAll(); }} style={{ background: '#1E3050', color: '#9DB0C7', fontSize: 11, padding: '6px 12px' }}>🔄</button>
        </div>
        {refresh.results.length > 0 && !refresh.running && (
          <div style={{ maxWidth: 1300, margin: '10px auto 0', padding: '8px 14px', borderRadius: 8, background: '#0F1D35', border: '1px solid #1E3050', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            {(() => { const fail = refresh.results.filter(r => r.status !== 'success'); return (<>
              <span style={{ color: fail.length > 0 ? '#F87171' : '#34D399', fontWeight: 700 }}>{fail.length > 0 ? '⚠️' : '✅'} {refresh.results.filter(r => r.status === 'success').length}/{refresh.results.length} 성공</span>
              <span style={{ color: '#7D8DA3' }}>{(refresh.elapsed/1000).toFixed(1)}초</span>
              {fail.length > 0 && <span style={{ color: '#F87171' }}>실패: {fail.map(f => CRON_MAP[f.name]?.display || f.name).join(', ')}</span>}
              <button onClick={() => setRefresh(prev => ({...prev, results: []}))} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7D8DA3', cursor: 'pointer', fontSize: 14 }}>×</button>
            </>); })()}
          </div>
        )}
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 20px 40px' }}>

        {/* KPI Cards */}
        <div className="cc-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10, marginBottom: 16 }}>
          {kpis.map((k, i) => (
            <div key={k.label} className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, padding: '14px 16px', border: '1px solid #1E3050', animation: `fadein .3s ease ${i*50}ms both` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{k.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: '#7D8DA3', fontWeight: 600, letterSpacing: 0.5 }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#E2E8F0', lineHeight: 1.1 }}>{k.value.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data Counts + 7-Day Trend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, padding: 16, border: '1px solid #1E3050' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 10, letterSpacing: 0.5 }}>데이터 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {dataCounts.map(d => (
                <div key={d.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#1E305040' }}>
                  <div style={{ fontSize: 14 }}>{d.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#E2E8F0' }}>{d.value.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#7D8DA3', fontWeight: 600 }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, padding: 16, border: '1px solid #1E3050' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 10, letterSpacing: 0.5 }}>7일 추이</div>
            {dailyStats.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { data: dailyStats.map(s => s.new_users||0), label: '가입', color: '#60A5FA' },
                  { data: dailyStats.map(s => s.new_posts||0), label: '게시글', color: '#34D399' },
                  { data: dailyStats.map(s => s.new_comments||0), label: '댓글', color: '#A78BFA' },
                  { data: dailyStats.map(s => s.total_page_views||0), label: 'PV', color: '#FBBF24' },
                ].map(c => (
                  <div key={c.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7D8DA3', marginBottom: 2 }}>
                      <span>{c.label}</span><span style={{ color: c.color, fontWeight: 700 }}>{c.data[c.data.length-1]}</span>
                    </div>
                    <MiniChart data={c.data} color={c.color} h={28} />
                  </div>
                ))}
              </div>
            ) : <div style={{ color: '#7D8DA3', fontSize: 12, textAlign: 'center', padding: 20 }}>데이터 부족</div>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="cc-card cc-section" style={{ background: '#0F1D35', borderRadius: 12, padding: '14px 16px', border: '1px solid #1E3050', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', letterSpacing: 0.5 }}>원클릭 실행</span>
            <span style={{ fontSize: 10, color: '#7D8DA3' }}>개별 크론 즉시 실행</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_ACTIONS.map(a => {
              const result = actionResults[a.id];
              return (
                <button key={a.id} className="cc-btn" onClick={() => runQuickAction(a)} disabled={!!actionRunning}
                  style={{ background: result ? (result.ok ? 'rgba(5,150,105,0.12)' : 'rgba(248,113,113,0.12)') : '#1E3050', color: result ? (result.ok ? '#34D399' : '#f87171') : '#9DB0C7', border: `1px solid ${result ? (result.ok ? 'rgba(5,150,105,0.25)' : 'rgba(248,113,113,0.25)') : '#2A4060'}` }}>
                  {actionRunning === a.id ? <span style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> : <span style={{ fontSize: 13 }}>{a.icon}</span>}
                  {result?.msg || a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cron Status Grid */}
        <div className="cc-card cc-section" style={{ background: '#0F1D35', borderRadius: 12, padding: '14px 16px', border: '1px solid #1E3050', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 12, letterSpacing: 0.5 }}>크론 상태 ({cronEntries.length}개)</div>
          {GROUPS_ORDER.map(group => {
            const gc = cronEntries.filter(c => c.group === group);
            if (!gc.length) return null;
            return (
              <div key={group} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLORS[group]||'#7D8DA3' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: GROUP_COLORS[group]||'#7D8DA3' }}>{group}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {gc.map(c => {
                    const isOk = c.latest?.status === 'success';
                    const isRun = c.latest?.status === 'running';
                    const isFail = !isOk && !isRun;
                    return (
                      <div key={c.name} style={{ padding: '6px 10px', borderRadius: 8, background: isOk ? '#05966910' : isFail ? '#F8717110' : '#60A5FA10', border: `1px solid ${isOk ? '#05966925' : isFail ? '#F8717125' : '#60A5FA25'}`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOk ? '#34D399' : isFail ? '#F87171' : '#60A5FA', animation: isRun ? 'pulse-dot 1s infinite' : 'none' }} />
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.display}</span>
                        <span style={{ color: '#7D8DA3', fontSize: 10 }}>{c.latest?.started_at ? timeAgo(c.latest.started_at) : '-'}</span>
                        <span style={{ color: '#7D8DA3', fontSize: 10 }}>{c.successRate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expandable Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {/* Blog Automation */}
          <div className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, border: '1px solid #1E3050', overflow: 'hidden' }}>
            <button onClick={() => toggle('blog')} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>📰</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>블로그 자동화</span>
              {queueStatus && <span style={{ fontSize: 10, color: '#34D399', fontWeight: 700 }}>큐 {queueStatus.queue_ready ?? 0}</span>}
              <span style={{ fontSize: 14, color: '#7D8DA3', transform: expandedPanel === 'blog' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
            {expandedPanel === 'blog' && blogConfig && (
              <div style={{ padding: '0 16px 16px', animation: 'fadein .2s ease' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9DB0C7', marginBottom: 6 }}>
                      <input type="checkbox" checked={blogConfig.auto_publish_enabled} onChange={e => setBlogConfig({...blogConfig,auto_publish_enabled:e.target.checked})} /> 자동 발행
                    </label>
                    {[
                      { k: 'daily_publish_limit', l: '일일 발행', min: 1, max: 50 },
                      { k: 'daily_create_limit', l: '일일 생성', min: 1, max: 50 },
                      { k: 'min_content_length', l: '최소 글자', min: 500, max: 3000 },
                      { k: 'title_similarity_threshold', l: '유사도', min: 0.1, max: 0.9 },
                    ].map(f => (
                      <div key={f.k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: '#7D8DA3', minWidth: 55 }}>{f.l}</span>
                        <input className="cc-input" type="number" min={f.min} max={f.max} step={f.k === 'title_similarity_threshold' ? 0.05 : f.k === 'min_content_length' ? 100 : 1}
                          value={(blogConfig as any)[f.k]} onChange={e => setBlogConfig({...blogConfig,[f.k]: f.k === 'title_similarity_threshold' ? parseFloat(e.target.value) : parseInt(e.target.value)})} />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <button className="cc-btn" onClick={saveBlogConfig} disabled={configSaving} style={{ background: '#60A5FA', color: '#fff' }}>{configSaving ? '...' : '저장'}</button>
                      {configMsg && <span style={{ fontSize: 10 }}>{configMsg}</span>}
                    </div>
                  </div>
                  {queueStatus && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { v: queueStatus.published_today??0, l: '오늘 발행', c: '#E2E8F0' },
                          { v: queueStatus.remaining_today??0, l: '남은 쿼터', c: '#E2E8F0' },
                          { v: queueStatus.queue_ready??0, l: '대기(가능)', c: '#34D399' },
                          { v: queueStatus.queue_too_short??0, l: '대기(미달)', c: (queueStatus.queue_too_short??0)>0?'#F87171':'#7D8DA3' },
                        ].map(q => (
                          <div key={q.l} style={{ textAlign: 'center', padding: 6, borderRadius: 6, background: '#1E305040' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: q.c }}>{q.v}</div>
                            <div style={{ fontSize: 8, color: '#7D8DA3' }}>{q.l}</div>
                          </div>
                        ))}
                      </div>
                      {(queueStatus.queue_ready??0)>0 && <div style={{ fontSize: 10, color: '#7D8DA3', marginTop: 6, textAlign: 'center' }}>소진: ~{Math.ceil(queueStatus.queue_ready/(blogConfig.daily_publish_limit||3))}일</div>}
                    </div>
                  )}
                </div>
                {rewriteStats && (
                  <div style={{ borderTop: '1px solid #1E3050', paddingTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA' }}>✍️ AI 리라이팅</span>
                      <span style={{ fontSize: 10, color: '#7D8DA3' }}>{rewriteStats.done}/{rewriteStats.total} ({pct(rewriteStats.done,rewriteStats.total)}%)</span>
                    </div>
                    <div className="cc-progress" style={{ marginBottom: 8 }}><div className="cc-progress-bar" style={{ width: `${pct(rewriteStats.done,rewriteStats.total)}%`, background: '#A78BFA' }} /></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="cc-btn" onClick={() => runRewrite(5)} disabled={rewriteRunning} style={{ background: '#A78BFA', color: '#fff' }}>{rewriteRunning ? '처리 중...' : '5건'}</button>
                      <button className="cc-btn" onClick={() => runRewrite(10)} disabled={rewriteRunning} style={{ background: '#A78BFA', color: '#fff' }}>10건</button>
                    </div>
                    {rewriteLog.length > 0 && <div className="cc-scrollbar" style={{ marginTop: 6, maxHeight: 80, overflow: 'auto', fontSize: 10, color: '#7D8DA3', background: '#1E305040', borderRadius: 6, padding: 6 }}>{rewriteLog.slice(-5).map((l,i)=><div key={i}>{l}</div>)}</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Users Summary */}
          <div className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, border: '1px solid #1E3050', overflow: 'hidden' }}>
            <button onClick={() => toggle('users')} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>👥</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>유저 관리</span>
              <span style={{ fontSize: 10, color: '#34D399', fontWeight: 700 }}>실제 {realUsers.length}</span>
              <span style={{ fontSize: 14, color: '#7D8DA3', transform: expandedPanel === 'users' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
            {expandedPanel === 'users' && (
              <div style={{ padding: '0 16px 16px', animation: 'fadein .2s ease' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                  {[{l:'전체',v:users.length,c:'#E2E8F0'},{l:'실제',v:realUsers.length,c:'#34D399'},{l:'시드',v:users.length-realUsers.length,c:'#7D8DA3'},{l:'정지',v:users.filter(u=>u.is_deleted).length,c:'#F87171'}].map(s=>(
                    <div key={s.l} style={{ textAlign: 'center', padding: 6, borderRadius: 6, background: '#1E305040' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 8, color: '#7D8DA3' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7D8DA3', marginBottom: 4 }}>최근 실제 가입</div>
                <div className="cc-scrollbar" style={{ maxHeight: 120, overflow: 'auto' }}>
                  {realUsers.slice(0,10).map(u=>(
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #1E305030', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>{u.nickname||'미설정'}</span>
                      <span style={{ color: '#7D8DA3' }}>{u.grade_title||'-'}</span>
                      <span style={{ color: '#7D8DA3' }}>{u.points??0}P</span>
                      <span style={{ color: '#7D8DA3', fontSize: 10 }}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  ))}
                </div>
                <a href="/admin/users" style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 10, color: '#60A5FA' }}>전체 유저 관리 →</a>
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, border: '1px solid #1E3050', overflow: 'hidden' }}>
            <button onClick={() => toggle('alerts')} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🔔</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>알림 / 신고</span>
              {unreadAlerts > 0 && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(251,191,36,0.12)', color: '#FBBF24', fontWeight: 700 }}>{unreadAlerts}</span>}
              <span style={{ fontSize: 14, color: '#7D8DA3', transform: expandedPanel === 'alerts' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
            {expandedPanel === 'alerts' && (
              <div style={{ padding: '0 16px 16px', animation: 'fadein .2s ease' }}>
                <div className="cc-scrollbar" style={{ maxHeight: 200, overflow: 'auto' }}>
                  {alerts.length === 0 ? <div style={{ color: '#7D8DA3', fontSize: 11, textAlign: 'center', padding: 12 }}>알림 없음</div> : alerts.map(a => (
                    <div key={a.id} onClick={() => !a.is_read && dismissAlert(a.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: '1px solid #1E305030', opacity: a.is_read ? 0.4 : 1, cursor: a.is_read ? 'default' : 'pointer', fontSize: 11 }}>
                      <span>{a.severity === 'error' ? '🔴' : a.severity === 'warning' ? '🟡' : '🟢'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: a.is_read ? 400 : 700, color: 'var(--text-primary)' }}>{a.title}</div>
                        {a.message && <div style={{ fontSize: 10, color: '#7D8DA3', marginTop: 1 }}>{a.message.slice(0,80)}</div>}
                      </div>
                      <span style={{ fontSize: 10, color: '#7D8DA3', whiteSpace: 'nowrap' }}>{a.created_at ? timeAgo(a.created_at) : ''}</span>
                    </div>
                  ))}
                </div>
                {pendingReports > 0 && (
                  <div style={{ borderTop: '1px solid #1E3050', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#F87171', marginBottom: 4 }}>미처리 신고 {pendingReports}건</div>
                    <a href="/admin/reports" style={{ fontSize: 10, color: '#60A5FA' }}>신고 관리 →</a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="cc-card" style={{ background: '#0F1D35', borderRadius: 12, border: '1px solid #1E3050', overflow: 'hidden' }}>
            <button onClick={() => toggle('tools')} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🛠</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>공지 / SEO / 도구</span>
              <span style={{ fontSize: 14, color: '#7D8DA3', transform: expandedPanel === 'tools' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </button>
            {expandedPanel === 'tools' && (
              <div style={{ padding: '0 16px 16px', animation: 'fadein .2s ease' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7D8DA3', marginBottom: 4 }}>전광판 공지</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <input value={noticeText} onChange={e => setNoticeText(e.target.value)} placeholder="전광판 공지 입력..." style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #1E3050', background: '#0F1D35', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }} />
                  <button className="cc-btn" onClick={postNotice} disabled={noticeSaving||!noticeText.trim()} style={{ background: '#2563EB', color: '#fff' }}>등록</button>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7D8DA3', marginBottom: 4 }}>SEO</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 10 }}>
                  {[{h:'/sitemap.xml',l:'sitemap.xml'},{h:'/robots.txt',l:'robots.txt'},{h:'/api/og?title=테스트',l:'OG 미리보기'}].map(lk=>(
                    <a key={lk.h} href={lk.h} target="_blank" style={{ color: '#60A5FA', padding: '3px 8px', borderRadius: 6, background: '#60A5FA10' }}>{lk.l}</a>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7D8DA3', marginBottom: 4 }}>관리 페이지</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                  {[{h:'/admin/content',l:'콘텐츠'},{h:'/admin/users',l:'유저'},{h:'/admin/reports',l:'신고'},{h:'/admin/blog',l:'블로그'},{h:'/admin/infra',l:'인프라'},{h:'/admin/realestate',l:'부동산'},{h:'/admin/payments',l:'결제'},{h:'/admin/notifications',l:'알림'},{h:'/admin/system',l:'시스템'}].map(l=>(
                    <a key={l.h} href={l.h} style={{ color: '#9DB0C7', padding: '3px 8px', borderRadius: 6, background: '#1E305040', textDecoration: 'none' }}>{l.l}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* API Quotas */}
        {quotas.length > 0 && (
          <div className="cc-card cc-section" style={{ background: '#0F1D35', borderRadius: 12, padding: '14px 16px', border: '1px solid #1E3050', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 10, letterSpacing: 0.5 }}>API 할당량</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {quotas.map(q => {
                const dp = q.daily_limit ? pct(q.daily_used,q.daily_limit) : 0;
                const mp = q.monthly_limit ? pct(q.monthly_used,q.monthly_limit) : 0;
                const bc = (p: number) => p >= 90 ? '#F87171' : p >= 70 ? '#FBBF24' : '#34D399';
                return (
                  <div key={q.api_name} style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{q.api_name}</div>
                    {q.daily_limit && <div style={{ marginBottom: 4 }}><div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:'#7D8DA3',marginBottom:2 }}><span>일일</span><span>{q.daily_used}/{q.daily_limit}</span></div><div className="cc-progress"><div className="cc-progress-bar" style={{ width:`${Math.min(dp,100)}%`,background:bc(dp) }} /></div></div>}
                    {q.monthly_limit && <div><div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:'#7D8DA3',marginBottom:2 }}><span>월간</span><span>{q.monthly_used}/{q.monthly_limit}</span></div><div className="cc-progress"><div className="cc-progress-bar" style={{ width:`${Math.min(mp,100)}%`,background:bc(mp) }} /></div></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cron Logs */}
        <div className="cc-card cc-section" style={{ background: '#0F1D35', borderRadius: 12, padding: '14px 16px', border: '1px solid #1E3050' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 10, letterSpacing: 0.5 }}>최근 크론 로그</div>
          <div className="cc-scrollbar" style={{ overflow: 'auto', maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ borderBottom: '1px solid #1E3050', textAlign: 'left' }}>
                {['시간','크론','상태','소요','처리','에러'].map(h=><th key={h} style={{ padding:'6px 8px',color:'#7D8DA3',fontWeight:600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {cronLogs.map((log,i) => (
                  <tr key={log.id||i} style={{ borderBottom: '1px solid #1E305020' }}>
                    <td style={{ padding:'5px 8px',color:'#7D8DA3',whiteSpace:'nowrap' }}>{log.started_at ? new Date(log.started_at).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'}</td>
                    <td style={{ padding:'5px 8px',color:'var(--text-primary)',fontWeight:600 }}>{CRON_MAP[log.cron_name]?.display||log.cron_name}</td>
                    <td style={{ padding:'5px 8px' }}><span style={{ fontSize:10,padding:'1px 6px',borderRadius:8,fontWeight:700,background:log.status==='success'?'rgba(5,150,105,0.12)':log.status==='running'?'rgba(96,165,250,0.12)':'rgba(248,113,113,0.12)',color:log.status==='success'?'#34D399':log.status==='running'?'#60a5fa':'#f87171' }}>{log.status}</span></td>
                    <td style={{ padding:'5px 8px',color:'#7D8DA3' }}>{log.duration_ms?`${(log.duration_ms/1000).toFixed(1)}s`:'-'}</td>
                    <td style={{ padding:'5px 8px',color:'#7D8DA3' }}>{log.records_processed||0}</td>
                    <td style={{ padding:'5px 8px',color:'#F87171',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{log.error_message||''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
