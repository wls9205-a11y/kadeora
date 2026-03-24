'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import dynamic from 'next/dynamic';

const AdminSites = dynamic(() => import('./AdminSites'), { ssr: false });

/* ─────────────────── Types ─────────────────── */
interface CronEntry { name: string; display: string; group: string; latest?: any; successRate: number }
interface RunResult { name: string; status: string; duration?: number }

/* ─────────────────── CRON MAP ─────────────────── */
const CRON_MAP: Record<string, { display: string; group: string }> = {
  'health-check':             { display: '헬스체크',       group: '시스템' },
  'daily-stats':              { display: '일일 통계',      group: '시스템' },
  'portfolio-snapshot':       { display: '포트폴리오 스냅',group: '시스템' },
  'auto-grade':               { display: '등급 갱신',      group: '시스템' },
  'expire-listings':          { display: '리스팅 만료',    group: '시스템' },
  'cleanup':                  { display: '데이터 정리',    group: '시스템' },
  'cleanup-pageviews':        { display: 'PV 정리',        group: '시스템' },
  'purge-withdrawn-consents': { display: '동의 파기',      group: '시스템' },
  'indexnow':                 { display: 'Bing 색인',      group: '시스템' },
  'stock-price':              { display: '주식 시세',      group: '주식' },
  'stock-refresh':            { display: '주식 실시간',    group: '주식' },
  'stock-theme-daily':        { display: '테마 갱신',      group: '주식' },
  'stock-daily-briefing':     { display: 'AI 시황',        group: '주식' },
  'stock-news-crawl':         { display: '주식 뉴스',      group: '주식' },
  'stock-flow-crawl':         { display: '수급 추정',      group: '주식' },
  'exchange-rate':            { display: '환율',           group: '주식' },
  'check-price-alerts':       { display: '가격 알림',      group: '주식' },
  'crawl-apt-trade':          { display: '실거래 수집',    group: '부동산' },
  'crawl-apt-resale':         { display: '재매매 수집',    group: '부동산' },
  'crawl-apt-subscription':   { display: '청약 수집',      group: '부동산' },
  'apt-backfill-details':     { display: '청약 상세 백필', group: '부동산' },
  'crawl-competition-rate':   { display: '경쟁률 수집',    group: '부동산' },
  'crawl-unsold-molit':       { display: '미분양 수집',    group: '부동산' },
  'crawl-seoul-redev':        { display: '서울 재개발',    group: '부동산' },
  'crawl-busan-redev':        { display: '부산 재개발',    group: '부동산' },
  'crawl-gyeonggi-redev':     { display: '경기 재개발',    group: '부동산' },
  'crawl-nationwide-redev':   { display: '전국 재개발',    group: '부동산' },
  'redev-verify-households':  { display: '세대수 검증',    group: '부동산' },
  'redev-geocode':            { display: '좌표 수집',      group: '부동산' },
  'aggregate-trade-stats':    { display: '거래 집계',      group: '부동산' },
  'sync-apt-sites':           { display: '현장 싱크',      group: '부동산' },
  'collect-site-images':      { display: '현장 이미지',    group: '부동산' },
  'collect-site-trends':      { display: '검색 트렌드',    group: '부동산' },
  'collect-site-facilities':  { display: '주변 인프라',    group: '부동산' },
  'apt-ai-summary':           { display: 'AI 분석',        group: '부동산' },
  'push-apt-deadline':        { display: '청약 마감 알림', group: '부동산' },
  'invest-calendar-refresh':  { display: '투자 캘린더',    group: '부동산' },
  'seed-posts':               { display: '시드 게시글',    group: '콘텐츠' },
  'seed-comments':            { display: '시드 댓글',      group: '콘텐츠' },
  'seed-chat':                { display: '시드 채팅',      group: '콘텐츠' },
  'push-daily-reminder':      { display: '매일 리마인더',  group: '콘텐츠' },
  'blog-daily':               { display: '블로그 발행',    group: '블로그' },
  'blog-afternoon':           { display: '오후 블로그',    group: '블로그' },
  'blog-publish-queue':       { display: '발행 큐',        group: '블로그' },
  'blog-series-assign':       { display: '시리즈 묶기',    group: '블로그' },
  'blog-rewrite':             { display: 'AI 리라이팅',    group: '블로그' },
  'blog-weekly-market':       { display: '주간 시장',      group: '블로그' },
  'blog-monthly-market':      { display: '월간 시장',      group: '블로그' },
  'blog-apt-new':             { display: '신규 분양',      group: '블로그' },
  'blog-apt-landmark':        { display: '랜드마크',       group: '블로그' },
  'blog-redevelopment':       { display: '재개발',         group: '블로그' },
  'blog-seed-guide':          { display: '가이드',         group: '블로그' },
  'blog-monthly-theme':       { display: '월별 테마',      group: '블로그' },
  'blog-seed-comments':       { display: '블로그 댓글',    group: '블로그' },
};

const SECTIONS = [
  { id: 'god',     label: '⚡ 전체 실행 (갓버튼)', desc: '모든 데이터·콘텐츠·시스템·현장 한 번에', color: 'var(--brand)',         glow: 'rgba(37,99,235,0.35)',   endpoints: ['/api/cron/health-check','/api/cron/stock-refresh','/api/cron/exchange-rate','/api/cron/crawl-apt-subscription','/api/cron/crawl-apt-trade','/api/cron/crawl-competition-rate','/api/cron/crawl-unsold-molit','/api/cron/crawl-seoul-redev','/api/cron/crawl-busan-redev','/api/cron/aggregate-trade-stats','/api/cron/sync-apt-sites','/api/cron/collect-site-images','/api/cron/collect-site-trends','/api/cron/collect-site-facilities','/api/cron/apt-ai-summary','/api/cron/stock-theme-daily','/api/cron/stock-daily-briefing','/api/cron/seed-posts','/api/cron/blog-publish-queue','/api/cron/daily-stats','/api/cron/auto-grade','/api/cron/cleanup','/api/cron/purge-withdrawn-consents','/api/cron/indexnow'] },
  { id: 'apt',     label: '🏠 부동산',            desc: '청약·실거래·재개발·미분양·현장·AI',  color: 'var(--accent-blue)',    glow: 'rgba(96,165,250,0.3)',   endpoints: ['/api/cron/crawl-apt-subscription','/api/cron/crawl-apt-trade','/api/cron/crawl-competition-rate','/api/cron/crawl-unsold-molit','/api/cron/crawl-seoul-redev','/api/cron/crawl-busan-redev','/api/cron/crawl-gyeonggi-redev','/api/cron/aggregate-trade-stats','/api/cron/sync-apt-sites','/api/cron/collect-site-images','/api/cron/apt-ai-summary'] },
  { id: 'stock',   label: '📈 주식',              desc: '시세·테마·AI시황·환율·수급',         color: 'var(--accent-yellow)',  glow: 'rgba(251,191,36,0.3)',   endpoints: ['/api/cron/stock-refresh','/api/cron/stock-theme-daily','/api/cron/stock-daily-briefing','/api/cron/exchange-rate','/api/cron/stock-news-crawl','/api/cron/stock-flow-crawl'] },
  { id: 'blog',    label: '📰 블로그',            desc: '발행큐·AI생성·시리즈·댓글',          color: 'var(--accent-purple)',  glow: 'rgba(167,139,250,0.3)', endpoints: ['/api/cron/blog-publish-queue','/api/cron/blog-daily','/api/cron/blog-series-assign','/api/cron/blog-seed-comments','/api/cron/blog-apt-new','/api/cron/blog-redevelopment'] },
  { id: 'content', label: '💬 커뮤니티',          desc: '시드 게시글·댓글·채팅',              color: 'var(--accent-green)',   glow: 'rgba(52,211,153,0.3)',   endpoints: ['/api/cron/seed-posts','/api/cron/seed-comments','/api/cron/seed-chat'] },
  { id: 'system',  label: '🔧 시스템',            desc: '헬스체크·통계·등급·정리',            color: '#7D8DA3',               glow: 'rgba(125,141,163,0.3)', endpoints: ['/api/cron/health-check','/api/cron/daily-stats','/api/cron/auto-grade','/api/cron/cleanup','/api/cron/expire-listings','/api/cron/indexnow'] },
];

const QUICK = [
  { id: 'health-check',   label: '헬스체크',    path: '/api/cron/health-check',               icon: '🩺' },
  { id: 'stock-refresh',  label: '주식 시세',   path: '/api/cron/stock-refresh',              icon: '📈' },
  { id: 'exchange-rate',  label: '환율',        path: '/api/cron/exchange-rate',              icon: '💱' },
  { id: 'apt-sub',        label: '청약 수집',   path: '/api/cron/crawl-apt-subscription',     icon: '🏠' },
  { id: 'apt-trade',      label: '실거래',      path: '/api/cron/crawl-apt-trade',            icon: '💰' },
  { id: 'apt-comp',       label: '경쟁률',      path: '/api/cron/crawl-competition-rate',     icon: '🏆' },
  { id: 'unsold',         label: '미분양',      path: '/api/cron/crawl-unsold-molit',         icon: '📉' },
  { id: 'seoul-redev',    label: '서울재개발',  path: '/api/cron/crawl-seoul-redev',          icon: '🔨' },
  { id: 'sync-sites',     label: '현장 싱크',   path: '/api/cron/sync-apt-sites',             icon: '🏗️' },
  { id: 'ai-summary',     label: 'AI분석',      path: '/api/cron/apt-ai-summary',             icon: '🤖' },
  { id: 'stock-theme',    label: '테마 갱신',   path: '/api/cron/stock-theme-daily',          icon: '🎯' },
  { id: 'stock-briefing', label: 'AI 시황',     path: '/api/cron/stock-daily-briefing',       icon: '📊' },
  { id: 'blog-queue',     label: '블로그 큐',   path: '/api/cron/blog-publish-queue',         icon: '📰' },
  { id: 'blog-rewrite',   label: 'AI 리라이팅', path: '/api/cron/blog-rewrite',               icon: '✍️' },
  { id: 'seed-posts',     label: '시드 게시글', path: '/api/cron/seed-posts',                 icon: '📝' },
  { id: 'daily-stats',    label: '일일 통계',   path: '/api/cron/daily-stats',                icon: '📋' },
  { id: 'auto-grade',     label: '등급 갱신',   path: '/api/cron/auto-grade',                 icon: '⭐' },
  { id: 'cleanup',        label: '정리',        path: '/api/cron/cleanup',                    icon: '🧹' },
  { id: 'redev-geocode',  label: '재개발 좌표', path: '/api/cron/redev-geocode',              icon: '📍' },
  { id: 'site-images',    label: '현장 이미지', path: '/api/cron/collect-site-images',        icon: '🖼️' },
  { id: 'indexnow',       label: 'Bing 색인',   path: '/api/cron/indexnow',                   icon: '🔍' },
  { id: 'purge-consents', label: '동의 파기',   path: '/api/cron/purge-withdrawn-consents',   icon: '🗑️' },
];

const GC: Record<string, string> = { '시스템': '#7D8DA3', '주식': 'var(--accent-yellow)', '부동산': 'var(--accent-blue)', '콘텐츠': 'var(--accent-green)', '블로그': 'var(--accent-purple)' };

export default function AdminCommandCenter({ healthChecks }: { healthChecks: { service_name: string; status: string }[] }) {
  const [kpi, setKpi] = useState({ dau: 0, newUsers: 0, newPosts: 0, newComments: 0 });
  const [counts, setCounts] = useState<{ label: string; value: number; icon: string }[]>([]);
  const [cronEntries, setCronEntries] = useState<CronEntry[]>([]);
  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [blogConfig, setBlogConfig] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [rewriteStats, setRewriteStats] = useState<{ total: number; done: number } | null>(null);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [qualityStats, setQualityStats] = useState({ redevNullHouseholds: 0, subWithConstructor: 0, aiSumSub: 0, aiSumRedev: 0, aiSumUnsold: 0, subTotal: 0, redevTotal: 0, unsoldTotal: 0 });
  const [noticeText, setNoticeText] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [runningSection, setRunningSection] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string; results: RunResult[]; elapsed: number }>({ done: 0, total: 0, current: '', results: [], elapsed: 0 });
  const [quickRunning, setQuickRunning] = useState<string | null>(null);
  const [quickResults, setQuickResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [rewriteRunning, setRewriteRunning] = useState(false);
  const [rewriteLog, setRewriteLog] = useState<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadAll = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [dauR, newUsersR, newPostsR, newCommentsR, usersR, postsR, blogsR, stocksR, aptSubR, aptTradeR, redevR, unsoldR, sitesR, interestsR, alertsR, logsR, statsR, configR, queueR, rwtR, rwdR, aiSubR, aiRevR, aiUnsR, nullHhR, ctorR] = await Promise.all([
        sb.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', today),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', today),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today),
        sb.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', today),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
        sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_site_interests').select('id', { count: 'exact', head: true }),
        sb.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(20),
        sb.from('cron_logs').select('*').order('started_at', { ascending: false }).limit(400),
        sb.from('daily_stats').select('*').order('stat_date', { ascending: false }).limit(7),
        sb.from('blog_publish_config').select('*').eq('id', 1).single(),
        sb.rpc('blog_queue_status'),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).not('rewritten_at', 'is', null),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }).not('ai_summary', 'is', null),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).not('ai_summary', 'is', null),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true).not('ai_summary', 'is', null),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).is('total_households', null),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }).not('constructor_nm', 'is', null),
      ]);
      setKpi({ dau: dauR.count || 0, newUsers: newUsersR.count || 0, newPosts: newPostsR.count || 0, newComments: newCommentsR.count || 0 });
      setCounts([
        { label: '유저', value: usersR.count || 0, icon: '👥' },
        { label: '게시글', value: postsR.count || 0, icon: '📝' },
        { label: '블로그', value: blogsR.count || 0, icon: '📰' },
        { label: '주식', value: stocksR.count || 0, icon: '📈' },
        { label: '청약', value: aptSubR.count || 0, icon: '🏠' },
        { label: '실거래', value: aptTradeR.count || 0, icon: '💰' },
        { label: '재개발', value: redevR.count || 0, icon: '🔨' },
        { label: '미분양', value: unsoldR.count || 0, icon: '📉' },
        { label: '현장허브', value: sitesR.count || 0, icon: '🏗️' },
        { label: '관심고객', value: interestsR.count || 0, icon: '📋' },
      ]);
      const allLogs = logsR.data || [];
      const lm = new Map<string, any>();
      for (const log of allLogs) { if (!lm.has(log.cron_name)) lm.set(log.cron_name, log); }
      setCronEntries(Array.from(lm.entries()).map(([name, latest]) => {
        const rc = allLogs.filter((l: any) => l.cron_name === name).slice(0, 10);
        const sc = rc.filter((l: any) => l.status === 'success').length;
        const info = CRON_MAP[name] || { display: name, group: '기타' };
        return { name, display: info.display, group: info.group, latest, successRate: rc.length > 0 ? Math.round((sc / rc.length) * 100) : 0 };
      }));
      setCronLogs(allLogs.slice(0, 50));
      setAlerts(alertsR.data || []);
      setDailyStats((statsR.data || []).reverse());
      setBlogConfig(configR.data);
      setQueueStatus(queueR.data);
      setRewriteStats({ total: rwtR.count ?? 0, done: rwdR.count ?? 0 });
      setQualityStats({ aiSumSub: aiSubR.count || 0, aiSumRedev: aiRevR.count || 0, aiSumUnsold: aiUnsR.count || 0, redevNullHouseholds: nullHhR.count || 0, subWithConstructor: ctorR.count || 0, subTotal: aptSubR.count || 0, redevTotal: redevR.count || 0, unsoldTotal: unsoldR.count || 0 });
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const runSection = async (section: typeof SECTIONS[number]) => {
    if (runningSection) return;
    setRunningSection(section.id);
    const total = section.endpoints.length;
    setProgress({ done: 0, total, current: '준비 중...', results: [], elapsed: 0 });
    const start = Date.now();
    timerRef.current = setInterval(() => setProgress(p => ({ ...p, elapsed: Date.now() - start })), 200);
    const results: RunResult[] = [];
    const BATCH = 3;
    for (let i = 0; i < section.endpoints.length; i += BATCH) {
      const batch = section.endpoints.slice(i, i + BATCH);
      const nm = CRON_MAP[batch[0].split('/').pop() || '']?.display || batch[0].split('/').pop() || '';
      setProgress(p => ({ ...p, current: nm }));
      const settled = await Promise.allSettled(batch.map(async ep => {
        const t = Date.now();
        try {
          const res = await fetch('/api/admin/trigger-cron', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: ep }) });
          return { name: CRON_MAP[ep.split('/').pop() || '']?.display || ep, status: res.ok ? 'success' : 'error', duration: Date.now() - t };
        } catch { return { name: ep, status: 'error', duration: Date.now() - t }; }
      }));
      for (const r of settled) {
        const v = r.status === 'fulfilled' ? r.value : { name: '?', status: 'error', duration: 0 };
        results.push(v);
        setProgress(p => ({ ...p, done: p.done + 1, results: [...results] }));
      }
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(p => ({ ...p, current: '완료', elapsed: Date.now() - start }));
    setRunningSection(null);
    setTimeout(() => {
      loadAll();
      // 현장관리 센터(AdminSites)에 리프레시 신호 전달
      window.dispatchEvent(new CustomEvent('admin-god-complete'));
    }, 1000);
  };

  const runQuick = async (q: typeof QUICK[number]) => {
    if (quickRunning) return;
    setQuickRunning(q.id);
    setQuickResults(p => ({ ...p, [q.id]: { ok: true, msg: '실행 중...' } }));
    try {
      const res = await fetch('/api/admin/trigger-cron', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: q.path }) });
      setQuickResults(p => ({ ...p, [q.id]: { ok: res.ok, msg: res.ok ? '✓ 완료' : `✗ ${res.status}` } }));
      if (res.ok) setTimeout(() => loadAll(), 800);
    } catch { setQuickResults(p => ({ ...p, [q.id]: { ok: false, msg: '✗ 에러' } })); }
    setQuickRunning(null);
    setTimeout(() => setQuickResults(p => { const n = { ...p }; delete n[q.id]; return n; }), 4000);
  };

  const saveBlogConfig = async () => {
    if (!blogConfig) return;
    setConfigSaving(true);
    const sb = createSupabaseBrowser();
    await sb.from('blog_publish_config').update({ daily_publish_limit: blogConfig.daily_publish_limit, daily_create_limit: blogConfig.daily_create_limit, min_content_length: blogConfig.min_content_length, title_similarity_threshold: blogConfig.title_similarity_threshold, auto_publish_enabled: blogConfig.auto_publish_enabled, updated_at: new Date().toISOString() }).eq('id', 1);
    setConfigSaving(false);
    setTimeout(() => loadAll(), 500);
  };

  const runRewrite = async (n: number) => {
    if (rewriteRunning) return;
    setRewriteRunning(true);
    setRewriteLog(p => [...p, `${n}건 시작...`]);
    try {
      const res = await fetch('/api/admin/blog-rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchSize: n }) });
      const d = await res.json();
      setRewriteLog(p => [...p, `완료: ${d.rewritten || 0}/${d.total || 0}건`]);
      setTimeout(() => loadAll(), 500);
    } catch (e: any) { setRewriteLog(p => [...p, `에러: ${e.message}`]); }
    setRewriteRunning(false);
  };

  const postNotice = async () => {
    if (!noticeText.trim()) return;
    const sb = createSupabaseBrowser();
    await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
    await sb.from('site_notices').insert({ content: noticeText.trim(), is_active: true });
    setNoticeText('');
  };

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간`; return `${Math.floor(h / 24)}일`; };
  const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

  const successCrons = cronEntries.filter(c => c.latest?.status === 'success').length;
  const failCrons = cronEntries.filter(c => c.latest?.status === 'error' || c.latest?.status === 'failed').length;
  const unreadAlerts = alerts.filter(a => !a.is_read).length;
  const isGodRunning = runningSection === 'god';
  const godSection = SECTIONS[0];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050A18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(37,99,235,0.15)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 14px' }} />
        <div style={{ color: '#7D8DA3', fontSize: 13, fontWeight: 600 }}>커맨드센터 로딩...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050A18', color: 'var(--text-primary)' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(37,99,235,0.35)}50%{box-shadow:0 0 50px rgba(37,99,235,0.7),0 0 80px rgba(37,99,235,0.2)}}
        .cc{transition:border-color .2s}.cc:hover{border-color:rgba(37,99,235,0.3)!important}
        .btn{padding:7px 13px;border-radius:8px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
        .btn:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}.btn:active:not(:disabled){transform:none}.btn:disabled{opacity:.45;cursor:not-allowed;transform:none;filter:none}
        .bar{height:4px;border-radius:2px;background:#152240;overflow:hidden}.bar-fill{height:100%;border-radius:2px;transition:width .4s}
        .scroll::-webkit-scrollbar{width:4px}.scroll::-webkit-scrollbar-thumb{background:#1E2E52;border-radius:2px}
        .sbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px 12px;border-radius:12px;border:1.5px solid;cursor:pointer;transition:all .2s;text-align:center;font-family:inherit}
        .sbtn:hover:not(:disabled){transform:translateY(-2px)}.sbtn:disabled{opacity:.45;cursor:not-allowed;transform:none}
      `}</style>

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(180deg,#0A1225 0%,#050A18 100%)', borderBottom: '1px solid #152240', padding: '11px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1340, margin: '0 auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--brand)', letterSpacing: -0.5 }}>카더라</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#7D8DA3', letterSpacing: 1.5 }}>COMMAND CENTER</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
            {healthChecks.map(hc => (
              <span key={hc.service_name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hc.status === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)', animation: hc.status !== 'ok' ? 'pulse 1.5s infinite' : 'none' }} />
                <span style={{ fontSize: 9, color: '#7D8DA3' }}>{hc.service_name}</span>
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: failCrons > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }} />
              <span style={{ fontSize: 9, color: '#7D8DA3' }}>크론 {successCrons}/{cronEntries.length}</span>
            </span>
            {unreadAlerts > 0 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(251,191,36,0.12)', color: 'var(--accent-yellow)', fontWeight: 700 }}>알림 {unreadAlerts}</span>}
            {failCrons > 0 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(248,113,113,0.12)', color: 'var(--accent-red)', fontWeight: 700 }}>⚠ 실패 {failCrons}</span>}
          </div>
          {lastRefresh && <span style={{ fontSize: 9, color: '#7D8DA3' }}>{lastRefresh.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button className="btn" onClick={() => { setLoading(true); loadAll(); }} style={{ background: '#152240', color: '#94A8C4', fontSize: 10 }}>🔄</button>
          <a href="/feed" style={{ fontSize: 10, color: '#7D8DA3', textDecoration: 'none' }}>← 사이트</a>
        </div>
      </div>

      <div style={{ maxWidth: 1340, margin: '0 auto', padding: '20px 20px 60px' }}>

        {/* ══ 갓버튼 ══ */}
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <button
            onClick={() => runSection(godSection)}
            disabled={!!runningSection}
            style={{ width: '100%', maxWidth: 640, padding: '20px 28px', borderRadius: 18, border: `2px solid ${isGodRunning ? 'var(--brand)' : 'rgba(37,99,235,0.45)'}`, background: isGodRunning ? 'rgba(37,99,235,0.12)' : 'linear-gradient(135deg,#0E1D38 0%,#172444 100%)', cursor: runningSection ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 18, animation: isGodRunning ? 'glow 1.5s infinite' : 'none', boxShadow: '0 4px 30px rgba(37,99,235,0.2)', transition: 'all .25s', fontFamily: 'inherit' }}
          >
            {isGodRunning ? (
              <>
                <span style={{ width: 30, height: 30, border: '3px solid rgba(37,99,235,0.2)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#E8EDF5' }}>실행 중... {progress.done}/{progress.total}</div>
                  <div style={{ fontSize: 12, color: 'var(--brand)', marginTop: 2 }}>{progress.current} · {((progress.elapsed / 1000) | 0)}초 경과</div>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 36 }}>⚡</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#E8EDF5' }}>전체 실행 — 갓버튼</div>
                  <div style={{ fontSize: 12, color: '#8BAACF', marginTop: 3 }}>데이터·주식·현장·블로그·시스템 — {godSection.endpoints.length}개 크론 · 현장관리센터 포함</div>
                </div>
              </>
            )}
          </button>
          {/* 갓버튼 포함 항목 요약 (대기 상태) */}
          {!runningSection && progress.results.length === 0 && (
            <div style={{ maxWidth: 640, margin: '8px auto 0', display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              {['헬스체크', '주식시세', '환율', '청약수집', '실거래', '경쟁률', '미분양', '서울재개발', '부산재개발', '거래집계', '현장싱크', '현장이미지', '검색트렌드', '주변인프라', 'AI분석', '테마갱신', 'AI시황', '시드게시글', '블로그큐', '일일통계', '등급갱신', '데이터정리', '동의파기', 'Bing색인'].map(t => (
                <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(37,99,235,0.08)', color: '#7D8DA3', border: '1px solid rgba(37,99,235,0.12)' }}>{t}</span>
              ))}
            </div>
          )}
          {/* 진행바 */}
          {isGodRunning && progress.total > 0 && (
            <div style={{ maxWidth: 640, margin: '8px auto 0' }}>
              <div className="bar"><div className="bar-fill" style={{ width: `${pct(progress.done, progress.total)}%`, background: 'var(--brand)' }} /></div>
            </div>
          )}
          {/* 완료 결과 */}
          {!runningSection && progress.results.length > 0 && (
            <div style={{ maxWidth: 640, margin: '8px auto 0', padding: '10px 14px', borderRadius: 10, background: '#0A1225', border: '1px solid #152240', display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              <span style={{ width: '100%', textAlign: 'center', fontSize: 11, color: progress.results.filter(r => r.status !== 'success').length === 0 ? 'var(--accent-green)' : 'var(--accent-yellow)', fontWeight: 700, marginBottom: 4 }}>
                {progress.results.filter(r => r.status === 'success').length}/{progress.results.length} 성공 · {((progress.elapsed / 1000) | 0)}초
              </span>
              {progress.results.map((r, i) => (
                <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: r.status === 'success' ? 'rgba(5,150,105,0.12)' : 'rgba(248,113,113,0.12)', color: r.status === 'success' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {r.status === 'success' ? '✓' : '✗'} {r.name}
                </span>
              ))}
              <button onClick={() => setProgress(p => ({ ...p, results: [] }))} style={{ fontSize: 11, background: 'none', border: 'none', color: '#7D8DA3', cursor: 'pointer', marginLeft: 'auto' }}>닫기</button>
            </div>
          )}
        </div>

        {/* ══ KPI ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[{ l: 'DAU (PV)', v: kpi.dau, c: 'var(--accent-blue)', i: '👁' }, { l: '오늘 가입', v: kpi.newUsers, c: 'var(--accent-green)', i: '🆕' }, { l: '오늘 게시글', v: kpi.newPosts, c: 'var(--accent-purple)', i: '📝' }, { l: '오늘 댓글', v: kpi.newComments, c: 'var(--accent-yellow)', i: '💬' }].map(k => (
            <div key={k.l} className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '12px 14px', border: '1px solid #152240' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{k.i}</span>
                <div><div style={{ fontSize: 9, color: '#7D8DA3', fontWeight: 600 }}>{k.l}</div><div style={{ fontSize: 22, fontWeight: 900, color: '#E8EDF5', lineHeight: 1.1 }}>{k.v.toLocaleString()}</div></div>
              </div>
            </div>
          ))}
        </div>

        {/* ══ 섹션 버튼 ══ */}
        <div className="cc" style={{ background: '#0A1225', borderRadius: 14, padding: '14px 16px', border: '1px solid #152240', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 10, letterSpacing: 0.5 }}>섹션별 원클릭</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 7 }}>
            {SECTIONS.slice(1).map(s => {
              const isRun = runningSection === s.id;
              return (
                <button key={s.id} className="sbtn" onClick={() => runSection(s)} disabled={!!runningSection}
                  style={{ background: isRun ? `${s.glow}` : '#0D1829', borderColor: isRun ? s.color : '#1E2E52' }}>
                  {isRun ? <span style={{ width: 22, height: 22, border: `2px solid rgba(255,255,255,0.1)`, borderTopColor: s.color, borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> : <span style={{ fontSize: 18 }}>{s.label.split(' ')[0]}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: isRun ? s.color : '#C8D5E8' }}>{s.label.split(' ').slice(1).join(' ')}</span>
                  <span style={{ fontSize: 9, color: '#7D8DA3', lineHeight: 1.4 }}>{s.desc}</span>
                  {isRun && <span style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>{progress.done}/{progress.total} · {((progress.elapsed / 1000) | 0)}s</span>}
                </button>
              );
            })}
          </div>
          {runningSection && runningSection !== 'god' && progress.total > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7D8DA3', marginBottom: 3 }}><span>{progress.current}</span><span>{progress.done}/{progress.total}</span></div>
              <div className="bar"><div className="bar-fill" style={{ width: `${pct(progress.done, progress.total)}%`, background: SECTIONS.find(s => s.id === runningSection)?.color || 'var(--brand)' }} /></div>
            </div>
          )}
        </div>

        {/* ══ 개별 퀵버튼 ══ */}
        <div className="cc" style={{ background: '#0A1225', borderRadius: 14, padding: '13px 16px', border: '1px solid #152240', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 8, letterSpacing: 0.5 }}>개별 크론 실행</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {QUICK.map(q => {
              const r = quickResults[q.id];
              return (
                <button key={q.id} className="btn" onClick={() => runQuick(q)} disabled={!!quickRunning}
                  style={{ background: r ? (r.ok ? 'rgba(5,150,105,0.12)' : 'rgba(248,113,113,0.12)') : '#152240', color: r ? (r.ok ? 'var(--accent-green)' : '#FF6B6B') : '#94A8C4', border: `1px solid ${r ? (r.ok ? 'rgba(5,150,105,0.25)' : 'rgba(248,113,113,0.25)') : '#1E2E52'}` }}>
                  {quickRunning === q.id ? <span style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> : <span style={{ fontSize: 12 }}>{q.icon}</span>}
                  {r?.msg || q.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ 데이터 현황 + 7일 추이 ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '13px 15px', border: '1px solid #152240' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 9 }}>데이터 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
              {counts.map(d => (
                <div key={d.label} style={{ textAlign: 'center', padding: '7px 3px', borderRadius: 7, background: '#15224040' }}>
                  <div style={{ fontSize: 13 }}>{d.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#E8EDF5' }}>{d.value.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: '#7D8DA3' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '13px 15px', border: '1px solid #152240' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 9 }}>7일 추이</div>
            {dailyStats.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {[{ data: dailyStats.map(s => s.new_users || 0), label: '가입', color: 'var(--accent-blue)' }, { data: dailyStats.map(s => s.new_posts || 0), label: '게시글', color: 'var(--accent-green)' }, { data: dailyStats.map(s => s.new_comments || 0), label: '댓글', color: 'var(--accent-purple)' }, { data: dailyStats.map(s => s.total_page_views || 0), label: 'PV', color: 'var(--accent-yellow)' }].map(c => {
                  const max = Math.max(...c.data, 1);
                  const pts = c.data.map((v, i) => `${(i / (c.data.length - 1)) * 120},${28 - (v / max) * 24}`).join(' ');
                  return (
                    <div key={c.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7D8DA3', marginBottom: 2 }}><span>{c.label}</span><span style={{ color: c.color, fontWeight: 700 }}>{c.data[c.data.length - 1]}</span></div>
                      <svg viewBox="0 0 120 28" width="100%" height="26"><polygon points={`0,28 ${pts} 120,28`} fill={`${c.color}15`} /><polyline fill="none" stroke={c.color} strokeWidth="1.5" points={pts} /></svg>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#7D8DA3', fontSize: 11, textAlign: 'center', padding: 16 }}>수집 중</div>}
          </div>
        </div>

        {/* ══ AI 분석 현황 ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '13px 15px', border: '1px solid #152240' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 9 }}>📊 데이터 품질</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {[{ icon: '🏘️', label: '세대수 미확인', value: qualityStats.redevNullHouseholds, color: 'var(--accent-orange)' }, { icon: '🏗️', label: '시공사 입력', value: qualityStats.subWithConstructor, color: 'var(--accent-green)' }, { icon: '🤖', label: 'AI 분석 완료', value: qualityStats.aiSumSub + qualityStats.aiSumRedev + qualityStats.aiSumUnsold, color: 'var(--accent-purple)' }].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '7px 3px', borderRadius: 7, background: '#15224040' }}>
                  <div style={{ fontSize: 14 }}>{item.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 9, color: '#7D8DA3' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '13px 15px', border: '1px solid #152240' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 9 }}>🤖 AI 분석 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {[{ label: '청약', done: qualityStats.aiSumSub, total: qualityStats.subTotal, color: 'var(--accent-blue)' }, { label: '재개발', done: qualityStats.aiSumRedev, total: qualityStats.redevTotal, color: 'var(--accent-green)' }, { label: '미분양', done: qualityStats.aiSumUnsold, total: qualityStats.unsoldTotal, color: 'var(--accent-yellow)' }].map(item => {
                const rate = pct(item.done, item.total);
                return (
                  <div key={item.label} style={{ textAlign: 'center', padding: '7px 3px', borderRadius: 7, background: '#15224040' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{rate}%</div>
                    <div style={{ fontSize: 9, color: '#7D8DA3' }}>{item.label} ({item.done}/{item.total})</div>
                    <div className="bar" style={{ marginTop: 3 }}><div className="bar-fill" style={{ width: `${rate}%`, background: item.color }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ 크론 상태 ══ */}
        <div className="cc" style={{ background: '#0A1225', borderRadius: 14, padding: '13px 15px', border: '1px solid #152240', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3' }}>크론 상태 ({cronEntries.length}개)</div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
              <span style={{ color: 'var(--accent-green)' }}>✓ {successCrons}</span>
              {failCrons > 0 && <span style={{ color: 'var(--accent-red)' }}>✗ {failCrons}</span>}
            </div>
          </div>
          {['시스템', '주식', '부동산', '콘텐츠', '블로그'].map(group => {
            const gc = cronEntries.filter(c => c.group === group);
            if (!gc.length) return null;
            return (
              <div key={group} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: GC[group] }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: GC[group] }}>{group}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {gc.map(c => {
                    const ok = c.latest?.status === 'success';
                    const run = c.latest?.status === 'running';
                    const fail = !ok && !run && c.latest;
                    return (
                      <div key={c.name} style={{ padding: '4px 8px', borderRadius: 6, background: ok ? '#05966910' : fail ? '#FF6B6B10' : '#15224030', border: `1px solid ${ok ? '#05966920' : fail ? '#FF6B6B20' : '#152240'}`, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: ok ? 'var(--accent-green)' : fail ? 'var(--accent-red)' : '#7D8DA3', animation: run ? 'pulse 1s infinite' : 'none' }} />
                        <span style={{ color: '#C8D5E8', fontWeight: 600 }}>{c.display}</span>
                        <span style={{ color: '#7D8DA3' }}>{c.latest?.started_at ? timeAgo(c.latest.started_at) : '-'}</span>
                        <span style={{ color: c.successRate >= 80 ? 'var(--accent-green)' : c.successRate >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>{c.successRate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ══ 블로그 + 공지/관리 ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '13px 15px', border: '1px solid #152240' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 9 }}>📰 블로그 자동화</div>
            {blogConfig && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#94A8C4', marginBottom: 6 }}>
                      <input type="checkbox" checked={blogConfig.auto_publish_enabled} onChange={e => setBlogConfig({ ...blogConfig, auto_publish_enabled: e.target.checked })} />
                      자동 발행 {blogConfig.auto_publish_enabled ? '🟢' : '🔴'}
                    </label>
                    {[{ k: 'daily_publish_limit', l: '일일 발행', min: 1, max: 50, step: 1 }, { k: 'daily_create_limit', l: '일일 생성', min: 1, max: 50, step: 1 }, { k: 'min_content_length', l: '최소 글자', min: 500, max: 5000, step: 100 }].map(f => (
                      <div key={f.k} style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: '#7D8DA3', minWidth: 48 }}>{f.l}</span>
                        <input type="number" min={f.min} max={f.max} step={f.step} value={blogConfig[f.k as keyof typeof blogConfig]} onChange={e => setBlogConfig({ ...blogConfig, [f.k]: parseInt(e.target.value) })}
                          style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #152240', background: '#050A18', color: '#e2e8f0', fontSize: 11, width: 58, outline: 'none' }} />
                      </div>
                    ))}
                    <button className="btn" onClick={saveBlogConfig} disabled={configSaving} style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--accent-purple)', border: '1px solid rgba(167,139,250,0.2)', marginTop: 6, fontSize: 11 }}>
                      {configSaving ? '...' : '💾 저장'}
                    </button>
                  </div>
                  {queueStatus && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, alignContent: 'start' }}>
                      {[{ v: queueStatus.published_today ?? 0, l: '오늘 발행' }, { v: queueStatus.remaining_today ?? 0, l: '남은 쿼터' }, { v: queueStatus.queue_ready ?? 0, l: '발행 가능' }, { v: queueStatus.queue_too_short ?? 0, l: '길이 미달' }].map(q => (
                        <div key={q.l} style={{ textAlign: 'center', padding: 5, borderRadius: 5, background: '#15224040' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#E8EDF5' }}>{q.v}</div>
                          <div style={{ fontSize: 8, color: '#7D8DA3' }}>{q.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {rewriteStats && (
                  <div style={{ borderTop: '1px solid #152240', paddingTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-purple)' }}>✍️ AI 리라이팅</span>
                      <span style={{ fontSize: 10, color: '#7D8DA3' }}>{rewriteStats.done}/{rewriteStats.total} ({pct(rewriteStats.done, rewriteStats.total)}%)</span>
                    </div>
                    <div className="bar" style={{ marginBottom: 6 }}><div className="bar-fill" style={{ width: `${pct(rewriteStats.done, rewriteStats.total)}%`, background: 'var(--accent-purple)' }} /></div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[5, 10, 30].map(n => (
                        <button key={n} className="btn" onClick={() => runRewrite(n)} disabled={rewriteRunning} style={{ background: 'rgba(167,139,250,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(167,139,250,0.2)' }}>
                          {rewriteRunning ? '...' : `${n}건`}
                        </button>
                      ))}
                    </div>
                    {rewriteLog.length > 0 && (
                      <div className="scroll" style={{ marginTop: 5, maxHeight: 55, overflow: 'auto', fontSize: 10, color: '#7D8DA3', background: '#15224040', borderRadius: 5, padding: 5 }}>
                        {rewriteLog.slice(-4).map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="cc" style={{ background: '#0A1225', borderRadius: 12, padding: '13px 15px', border: '1px solid #152240' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-yellow)', marginBottom: 9 }}>🛠 공지 / 관리</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#7D8DA3', marginBottom: 4 }}>전광판 공지 등록</div>
              <div style={{ display: 'flex', gap: 5 }}>
                <input value={noticeText} onChange={e => setNoticeText(e.target.value)} placeholder="공지 입력..."
                  style={{ flex: 1, padding: '6px 9px', borderRadius: 6, border: '1px solid #152240', background: '#050A18', color: '#e2e8f0', fontSize: 11, outline: 'none' }} />
                <button className="btn" onClick={postNotice} disabled={!noticeText.trim()} style={{ background: 'var(--brand)', color: '#fff' }}>등록</button>
              </div>
            </div>
            <div style={{ fontSize: 9, color: '#7D8DA3', marginBottom: 4 }}>SEO 확인</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {[{ h: '/sitemap.xml', l: 'sitemap' }, { h: '/robots.txt', l: 'robots' }, { h: '/opensearch.xml', l: 'opensearch' }, { h: '/api/og?title=테스트', l: 'OG 미리보기' }].map(lk => (
                <a key={lk.h} href={lk.h} target="_blank" style={{ fontSize: 10, color: 'var(--accent-blue)', padding: '2px 7px', borderRadius: 5, background: '#6CB4FF10', textDecoration: 'none' }}>{lk.l}</a>
              ))}
            </div>
            <div style={{ fontSize: 9, color: '#7D8DA3', marginBottom: 5 }}>관리 페이지</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[{ h: '/admin/content', l: '콘텐츠' }, { h: '/admin/users', l: '유저' }, { h: '/admin/reports', l: '신고' }, { h: '/admin/comments', l: '댓글' }, { h: '/admin/blog', l: '블로그' }, { h: '/admin/infra', l: '인프라' }, { h: '/admin/realestate', l: '부동산' }, { h: '/admin/payments', l: '결제' }, { h: '/admin/notifications', l: '알림' }, { h: '/admin/system', l: '시스템' }].map(l => (
                <a key={l.h} href={l.h} style={{ fontSize: 10, color: '#94A8C4', padding: '3px 8px', borderRadius: 5, background: '#15224040', textDecoration: 'none' }}>{l.l}</a>
              ))}
            </div>
            {unreadAlerts > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid #152240', paddingTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-yellow)', marginBottom: 5 }}>🔔 알림 {unreadAlerts}건</div>
                {alerts.filter(a => !a.is_read).slice(0, 3).map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 5, padding: '3px 0', borderBottom: '1px solid #15224015', fontSize: 10 }}>
                    <span>{a.severity === 'error' ? '🔴' : '🟡'}</span>
                    <span style={{ color: '#C8D5E8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                    <span style={{ color: '#7D8DA3', whiteSpace: 'nowrap' }}>{a.created_at ? timeAgo(a.created_at) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ 크론 로그 ══ */}
        <div className="cc" style={{ background: '#0A1225', borderRadius: 14, padding: '13px 15px', border: '1px solid #152240' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7D8DA3', marginBottom: 8 }}>최근 크론 로그 (50건)</div>
          <div className="scroll" style={{ overflow: 'auto', maxHeight: 260 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead><tr style={{ borderBottom: '1px solid #152240' }}>
                {['시간', '크론', '상태', '소요', '처리', '에러'].map(h => <th key={h} style={{ padding: '5px 7px', color: '#7D8DA3', fontWeight: 600, textAlign: 'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {cronLogs.map((log, i) => (
                  <tr key={log.id || i} style={{ borderBottom: '1px solid #15224012' }}>
                    <td style={{ padding: '4px 7px', color: '#7D8DA3', whiteSpace: 'nowrap' }}>{log.started_at ? new Date(log.started_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td style={{ padding: '4px 7px', color: '#C8D5E8', fontWeight: 600 }}>{CRON_MAP[log.cron_name]?.display || log.cron_name}</td>
                    <td style={{ padding: '4px 7px' }}><span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, fontWeight: 700, background: log.status === 'success' ? 'rgba(5,150,105,0.12)' : log.status === 'running' ? 'rgba(96,165,250,0.12)' : 'rgba(248,113,113,0.12)', color: log.status === 'success' ? 'var(--accent-green)' : log.status === 'running' ? '#60a5fa' : '#FF6B6B' }}>{log.status}</span></td>
                    <td style={{ padding: '4px 7px', color: '#7D8DA3' }}>{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-'}</td>
                    <td style={{ padding: '4px 7px', color: '#7D8DA3' }}>{log.records_processed || 0}</td>
                    <td style={{ padding: '4px 7px', color: 'var(--accent-red)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.error_message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <AdminSites />
    </div>
  );
}
