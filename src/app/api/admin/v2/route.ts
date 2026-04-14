import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { classifyReferrer } from '@/lib/referrer-classify';

export const maxDuration = 30;

// Supabase query returns PromiseLike (no .catch), wrap safely
async function safe<T>(p: PromiseLike<{ data: T; error: any }>, fallback: T): Promise<T> {
  try { const r = await p; return r.error ? fallback : (r.data ?? fallback); } catch { return fallback; }
}
async function safeCount(p: PromiseLike<{ count: number | null; error: any }>): Promise<number> {
  try { const r = await p; return r.error ? 0 : (r.count ?? 0); } catch { return 0; }
}

/**
 * Admin Dashboard v2 API
 * GET /api/admin/v2?tab=focus|growth|users|data|ops
 *
 * 각 탭에 필요한 데이터만 반환 (경량)
 */

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const sb = auth.admin as any;

  const tab = req.nextUrl.searchParams.get('tab') || 'focus';

  try {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    // KST 기준 오늘 자정 (UTC 변환) — 어드민 "오늘" 수치는 전부 KST 기준
    const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const todayKST = new Date(kstToday + 'T00:00:00+09:00').toISOString();

    // ═══════════════════════════════════════
    // 🎯 집중 탭
    // ═══════════════════════════════════════
    if (tab === 'focus') {
      const [users, realUsers, newUsers, activeUsers, blogs, rewritten, cronOk, cronFail, interests, emailSubs, pushSubs, convEvents, dbMb, pvToday, notifRead7d, notifTotal7d, profileCompleted, onboardedCount, ctaViews7d, ctaClicks7d, postsToday, commentsToday, totalPosts, totalComments, hotBlogs, newBlogs24, aptSites, aptDeadline7, ctaViews24, ctaClicks24, notifSent24, notifRead24, bioCount, ageCount, pv7d, shares7d, sharesByPlatformRaw, newUsersToday, sharesToday, gateViews24, gateClicks24, signupAttempts24, signupSuccess24, signupAttempts7d] = await Promise.all([
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true })),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true)),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).neq('is_seed', true).neq('is_ghost', true)),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).not('last_active_at', 'is', null).neq('is_seed', true).neq('is_ghost', true)),
        safeCount(sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true)),
        safeCount(sb.from('blog_posts').select('id', { count: 'exact', head: true }).not('rewritten_at', 'is', null)),
        safeCount(sb.from('cron_logs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('created_at', dayAgo)),
        safeCount(sb.from('cron_logs').select('id', { count: 'exact', head: true }).in('status', ['error','failed']).gte('created_at', dayAgo)),
        safeCount(sb.from('apt_site_interests').select('id', { count: 'exact', head: true })),
        safeCount((sb as any).from('email_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true)),
        safeCount(sb.from('push_subscriptions').select('id', { count: 'exact', head: true })),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
        safe(sb.rpc('get_db_size_mb'), 1852),
        safeCount(sb.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        // 성장 분석 추가 쿼리
        safeCount(sb.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', true).gte('created_at', weekAgo)),
        safeCount(sb.from('notifications').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo)),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('profile_completed', true).neq('is_seed', true).neq('is_ghost', true)),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarded', true).neq('is_seed', true).neq('is_ghost', true)),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).eq('event_type', 'cta_view').gte('created_at', weekAgo)),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).eq('event_type', 'cta_click').gte('created_at', weekAgo)),
        safeCount(sb.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        safeCount(sb.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        // 확장 쿼리 (13개)
        safeCount(sb.from('posts').select('id', { count: 'exact', head: true })),
        safeCount(sb.from('comments').select('id', { count: 'exact', head: true })),
        safeCount(sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).gt('view_count', 50)),
        safeCount(sb.from('blog_posts').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        safeCount(sb.from('apt_sites').select('id', { count: 'exact', head: true })),
        safeCount(sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }).gte('rcept_endde', kstToday).lte('rcept_endde', new Date(Date.now()+7*86400000+9*3600000).toISOString().slice(0,10))),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).eq('event_type', 'cta_view').gte('created_at', todayKST)),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).eq('event_type', 'cta_click').gte('created_at', todayKST)),
        safeCount(sb.from('notifications').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        safeCount(sb.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', true).gte('created_at', todayKST)),
        safeCount((sb as any).from('profiles').select('id', { count: 'exact', head: true }).or('is_seed.is.null,is_seed.eq.false').not('bio', 'is', null)),
        safeCount((sb as any).from('profiles').select('id', { count: 'exact', head: true }).or('is_seed.is.null,is_seed.eq.false').not('age_group', 'is', null)),
        safeCount(sb.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now()-7*86400000).toISOString())),
        safeCount(sb.from('share_logs').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now()-7*86400000).toISOString())),
        safe((sb as any).from('share_logs').select('platform, content_type').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).limit(500), []),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayKST).neq('is_seed', true).neq('is_ghost', true)),
        safeCount((sb as any).from('share_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).eq('cta_name', 'content_gate').eq('event_type', 'cta_view').gte('created_at', todayKST)),
        safeCount((sb as any).from('conversion_events').select('id', { count: 'exact', head: true }).eq('cta_name', 'content_gate').eq('event_type', 'cta_click').gte('created_at', todayKST)),
        safeCount((sb as any).from('signup_attempts').select('id', { count: 'exact', head: true }).gte('created_at', todayKST)),
        safeCount((sb as any).from('signup_attempts').select('id', { count: 'exact', head: true }).eq('success', true).gte('created_at', todayKST)),
        safeCount((sb as any).from('signup_attempts').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now()-7*86400000).toISOString())),
      ]);

      const totalCron = cronOk + cronFail;
      const cronRate = totalCron > 0 ? cronOk / totalCron : 1;
      
      
      const returnRate = realUsers > 0 ? activeUsers / realUsers : 0;
      
      
      const rewriteRate = blogs > 0 ? rewritten / blogs : 0;
      

      // 건강 점수 계산 (100점 만점)
      const scores = {
        cronHealth: Math.min(cronRate * 100, 100) * 0.15,
        newUsers: Math.min(newUsers / 20, 1) * 100 * 0.15,
        returnRate: returnRate * 100 * 0.15,
        conversionRate: Math.min(0.13 / 2, 1) * 100 * 0.10,
        rewriteRate: rewriteRate * 100 * 0.10,
        subscriptions: Math.min((interests + emailSubs + pushSubs) / 50, 1) * 100 * 0.10,
        dataFreshness: 80 * 0.10, // 추후 실제 계산
        seoIndex: 50 * 0.05, // 추후 실제 계산
        errorRate: (1 - Math.min(cronFail / Math.max(totalCron, 1), 1)) * 100 * 0.05,
        dbHeadroom: Math.min(((8192 - dbMb) / 8192) * 100, 100) * 0.05,
      };
      const healthScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0));

      // 최근 활동 피드 (크론 + 가입)
      const { data: recentCrons } = await sb.from('cron_logs')
        .select('cron_name, status, records_processed, created_at')
        .order('created_at', { ascending: false }).limit(5);

      const { data: recentSignups } = await sb.from('profiles')
        .select('nickname, provider, created_at, residence_city')
        .neq('is_seed', true).neq('is_ghost', true)
        .order('created_at', { ascending: false }).limit(3);

      // 카테고리별 효율
    // 카테고리별 효율 (SQL 집계)
    let catRaw: any = null;
    try { const { data } = await (sb as any).rpc('get_blog_category_stats'); catRaw = data; } catch {}

    // SEO 포털별 준비도 — 전용 RPC 함수
    let seoPortal: any = { google: 0, naver: 0, both: 0, excerpt: 0, links: 0, title: 0, meta: 0 };
    try {
      const { data: seoData } = await (sb as any).rpc('get_seo_portal_stats');
      if (seoData && typeof seoData === 'object') seoPortal = seoData;
    } catch {}
    const catMap: Record<string, { count: number; views: number }> = {};
    if (Array.isArray(catRaw)) {
      for (const r of catRaw) { catMap[r.category] = { count: r.cnt, views: r.views }; }
    }

    // 실패 크론 목록
      const { data: failedCrons } = await sb.from('cron_logs')
        .select('cron_name, error_message, created_at')
        .eq('status', 'failed').gte('created_at', dayAgo)
        .order('created_at', { ascending: false }).limit(10);


    // 실패 크론 그룹핑
      const failGroups: Record<string, { count: number; lastError: string; lastAt: string }> = {};
      for (const f of (failedCrons || [])) {
        if (!failGroups[f.cron_name]) {
          failGroups[f.cron_name] = { count: 0, lastError: f.error_message || '', lastAt: f.created_at };
        }
        failGroups[f.cron_name].count++;
      }

      // 일별 추이 (14일)
      const { data: dailyStats } = await sb.from('daily_stats')
        .select('stat_date, total_users, new_users, dau, total_blogs')
        .order('stat_date', { ascending: false }).limit(14);

      // 주식/부동산 KPI
      const [stockR, aptR, unsoldR, redevR] = await Promise.all([
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      // CTA별 성과 (7일)
      const { data: ctaBreakdownRaw } = await (sb as any).from('conversion_events')
        .select('cta_name, event_type')
        .gte('created_at', weekAgo);
      const ctaBreakdown: Record<string, { views: number; clicks: number }> = {};
      for (const e of (ctaBreakdownRaw || [])) {
        if (!ctaBreakdown[e.cta_name]) ctaBreakdown[e.cta_name] = { views: 0, clicks: 0 };
        if (e.event_type === 'cta_view') ctaBreakdown[e.cta_name].views++;
        else if (e.event_type === 'cta_click') ctaBreakdown[e.cta_name].clicks++;
      }

      // 가입 귀속 (signup_source)
      const { data: signupSourceRaw } = await sb.from('profiles')
        .select('signup_source')
        .neq('is_seed', true)
        .not('signup_source', 'is', null);
      const signupSources: Record<string, number> = {};
      for (const p of (signupSourceRaw || [])) {
        const s = p.signup_source || 'direct';
        signupSources[s] = (signupSources[s] || 0) + 1;
      }

      // D7 리텐션 (최근 코호트)
      const { data: retentionRaw } = await (sb as any).from('retention_cohort')
        .select('cohort_week, cohort_size, d7_retained')
        .order('cohort_week', { ascending: false }).limit(4);
      const latestRetention = (retentionRaw || []).length > 0 ? retentionRaw[0] : null;

      // 기능 건강도 (핵심 기능 사용 현황)
      const [aptBmR, blogBmR, stockWlR, alertsR, attendR, missionR] = await Promise.all([
        safeCount((sb as any).from('apt_bookmarks').select('id', { count: 'exact', head: true })),
        safeCount((sb as any).from('blog_bookmarks').select('id', { count: 'exact', head: true })),
        safeCount((sb as any).from('stock_watchlist').select('id', { count: 'exact', head: true })),
        safeCount((sb as any).from('price_alerts').select('id', { count: 'exact', head: true })),
        safeCount((sb as any).from('attendance').select('user_id', { count: 'exact', head: true })),
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('first_mission_completed', true).neq('is_seed', true)),
      ]);

      // 이슈 감지 현황
      const [issuePending, issuePublished, issueTotal] = await Promise.all([
        safeCount((sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('is_processed', false)),
        safeCount((sb as any).from('issue_alerts').select('id', { count: 'exact', head: true }).eq('is_published', true)),
        safeCount((sb as any).from('issue_alerts').select('id', { count: 'exact', head: true })),
      ]);

      // ── 대시보드 미니위젯용 상세 데이터 ──
      const [recentSignupsR, pendingIssuesR, recentPostsR, recentCommentsR] = await Promise.all([
        (sb as any).from('profiles')
          .select('id, nickname, provider, signup_source, onboarded, created_at, points')
          .neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true)
          .order('created_at', { ascending: false }).limit(8),
        (sb as any).from('issue_alerts')
          .select('id, title, category, final_score, is_processed, publish_decision, detected_at')
          .eq('is_processed', false)
          .order('final_score', { ascending: false }).limit(5),
        sb.from('posts')
          .select('id, title, category, created_at, likes_count')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }).limit(5),
        sb.from('comments')
          .select('id, content, created_at')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }).limit(3),
      ]);

      return NextResponse.json({
        healthScore,
        scoreBreakdown: scores,
        kpi: {
          users: realUsers, newUsers, activeUsers, returnRate: Math.round(returnRate * 100),
          blogs, rewritten, rewriteRate: Math.round(rewriteRate * 100),
          stocks: stockR.count ?? 0, apts: aptR.count ?? 0,
          unsold: unsoldR.count ?? 0, redev: redevR.count ?? 0,
          interests,
          emailSubs, pushSubs, neverActive: (realUsers ?? 0) - (activeUsers ?? 0),
          conversions: convEvents,
          cronSuccess: cronOk, cronFail,
          dbMb,
          pvToday,
          newUsersToday,
          issuePending, issuePublished, issueTotal,
        },
        // 성장 분석
        growth: {
          notifReadRate: notifTotal7d > 0 ? Math.round(notifRead7d / notifTotal7d * 100) : 0,
          notifRead7d, notifTotal7d,
          profileCompleted, onboardedCount,
          profileRate: realUsers > 0 ? Math.round(profileCompleted / realUsers * 100) : 0,
          onboardRate: realUsers > 0 ? Math.round(onboardedCount / realUsers * 100) : 0,
          ctaViews7d, ctaClicks7d,
          ctaCtr: ctaViews7d > 0 ? Math.round(ctaClicks7d / ctaViews7d * 10000) / 100 : 0,
          postsToday, commentsToday,
        },
        extended: {
          totalPosts, totalComments, hotBlogs, newBlogs24, aptSites, aptDeadline7,
          ctaViews24, ctaClicks24, notifSent24, notifRead24, bioCount, ageCount, pv7d,
          // 데이터 수집률
          dataCollection: await (async () => {
            try {
              const base = 'is_seed.is.null,is_seed.eq.false';
              const [city, mkt, phone, interestsSet] = await Promise.all([
                safeCount((sb as any).from('profiles').select('id', { count: 'exact', head: true }).or(base).not('residence_city', 'is', null)),
                safeCount((sb as any).from('profiles').select('id', { count: 'exact', head: true }).or(base).eq('marketing_agreed', true)),
                safeCount((sb as any).from('profiles').select('id', { count: 'exact', head: true }).or(base).not('phone', 'is', null)),
                safeCount((sb as any).from('profiles').select('id', { count: 'exact', head: true }).or(base).not('interests', 'eq', '{}')),
              ]);
              return { city, marketing: mkt, phone, bio: bioCount, age: ageCount, interests: interestsSet, total: realUsers };
            } catch { return { city: 0, marketing: 0, phone: 0, bio: bioCount, age: ageCount, interests: 0, total: realUsers }; }
          })(),
          shares7d: shares7d ?? 0,
          sharesToday: sharesToday ?? 0, gateViews: gateViews24 ?? 0, gateClicks: gateClicks24 ?? 0, signupAttempts: signupAttempts24 ?? 0, signupSuccess: signupSuccess24 ?? 0, signupAttempts7d: signupAttempts7d ?? 0,
          sharesByPlatform: (() => { const m: Record<string,number> = {}; for (const r of (sharesByPlatformRaw || [])) { const p = (r as any)?.platform || 'unknown'; m[p] = (m[p]||0)+1; } return m; })(),
          sharesByContentType: (() => { const m: Record<string,number> = {}; for (const r of (sharesByPlatformRaw || [])) { const ct = (r as any)?.content_type || 'unknown'; m[ct] = (m[ct]||0)+1; } return m; })(),
          seeds: (users ?? 0) - realUsers,
          // SEO 포털별 준비도
          googleReady: seoPortal.google || 0, naverReady: seoPortal.naver || 0, bothReady: seoPortal.both || 0,
          excerptOk: seoPortal.excerpt || 0, linksOk: seoPortal.links || 0, titleGood: seoPortal.title || 0, metaGood: seoPortal.meta || 0,
          imageAltOk: seoPortal.imageAlt || 0, tagsOk: seoPortal.tags || 0, keywordsOk: seoPortal.keywords || 0,
          indexedOk: seoPortal.indexed || 0, contentLongOk: seoPortal.contentLong || 0, authorOk: seoPortal.author || 0,
          seriesOk: seoPortal.series || 0, tierA: seoPortal.tierA || 0, tierB: seoPortal.tierB || 0, tierC: seoPortal.tierC || 0,
          avgContentLen: seoPortal.avgContentLen || 0,
          // 트래픽
          active5m: 0, active30m: 0, pv1h: 0,
          // 리라이팅
          rwDone: rewritten, rwTotal: blogs,
          // 블로그 품질 분포
          blogQuality: await (async () => {
            try {
              const { data: tiers } = await (sb as any).from('blog_posts')
                .select('seo_tier')
                .eq('is_published', true)
                .not('seo_tier', 'is', null);
              const dist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, F: 0 };
              for (const t of (tiers || [])) { if (t.seo_tier && dist[t.seo_tier] !== undefined) dist[t.seo_tier]++; }
              const inlineHtml = await (sb as any).from('blog_posts')
                .select('id', { count: 'exact', head: true })
                .eq('is_published', true)
                .like('content', '%style=%background:#0f172a%');
              return { ...dist, inlineHtml: inlineHtml.count ?? 0, scored: (tiers || []).length, total: blogs };
            } catch { return { S: 0, A: 0, B: 0, C: 0, F: 0, inlineHtml: 0, scored: 0, total: blogs }; }
          })(),
          // 푸시 발송 성과
          pushStats: await (async () => {
            try {
              const { data: logs } = await (sb as any).from('push_logs')
                .select('title, sent_count, click_count, created_at')
                .order('created_at', { ascending: false })
                .limit(10);
              const totalSent = (logs || []).reduce((s: number, l: any) => s + (l.sent_count || 0), 0);
              const totalClicked = (logs || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
              return {
                recentLogs: (logs || []).map((l: any) => ({
                  title: (l.title || '').slice(0, 40),
                  sent: l.sent_count || 0,
                  clicked: l.click_count || 0,
                  ctr: l.sent_count > 0 ? Math.round((l.click_count || 0) / l.sent_count * 1000) / 10 : 0,
                  ago: l.created_at,
                })),
                totalSent, totalClicked,
                avgCtr: totalSent > 0 ? Math.round(totalClicked / totalSent * 1000) / 10 : 0,
                pushSubs: pushSubs ?? 0,
                notifReadRate24: (notifSent24 ?? 0) > 0 ? Math.round((notifRead24 ?? 0) / (notifSent24 ?? 0) * 100) : 0,
              };
            } catch { return { recentLogs: [], totalSent: 0, totalClicked: 0, avgCtr: 0, pushSubs: 0, notifReadRate24: 0 }; }
          })(),
        },
        categoryStats: Object.entries(catMap).map(([k, v]) => ({ category: k, count: v.count, views: v.views, efficiency: v.count > 0 ? Math.round(v.views / v.count) : 0 })).sort((a: any, b: any) => b.efficiency - a.efficiency),
        failedCrons: failGroups,
        recentActivity: [
          ...(recentCrons || []).map((c: any) => ({
            type: 'cron', name: c.cron_name, status: c.status,
            count: c.records_processed, at: c.created_at,
          })),
          ...(recentSignups || []).map((u: any) => ({
            type: 'signup', name: u.nickname, provider: u.provider,
            city: u.residence_city, at: u.created_at,
          })),
        ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8),
        dailyTrend: dailyStats,
        ctaBreakdown,
        // 가입 시도 소스별 분석
        signupBySource: await (async () => {
          const { data: attempts } = await (sb as any).from('signup_attempts')
            .select('source, success, provider')
            .gte('created_at', new Date(Date.now()-7*86400000).toISOString())
            .limit(500);
          const sources: Record<string, { attempts: number; success: number }> = {};
          for (const a of (attempts || [])) {
            const src = a.source || 'unknown';
            if (!sources[src]) sources[src] = { attempts: 0, success: 0 };
            sources[src].attempts++;
            if (a.success) sources[src].success++;
          }
          return sources;
        })(),
        signupSources,
        retention: latestRetention ? {
          cohortWeek: latestRetention.cohort_week,
          size: latestRetention.cohort_size,
          d7: latestRetention.d7_retained,
          d7Rate: latestRetention.cohort_size > 0 ? Math.round(latestRetention.d7_retained / latestRetention.cohort_size * 100) : 0,
        } : null,
        featureHealth: {
          aptBookmarks: aptBmR, blogBookmarks: blogBmR, stockWatchlist: stockWlR,
          priceAlerts: alertsR, attendance: attendR, missionCompleted: missionR,
        },
        // 행동 분석 (user_events 기반)
        behavior: await (async () => {
          try {
            const todayStr = todayKST;
            const [eventsToday, scrollR, dwellR] = await Promise.all([
              safeCount((sb as any).from('user_events').select('id', { count: 'exact', head: true }).gte('created_at', todayStr)),
              safe((sb as any).from('user_events').select('properties').eq('event_type', 'scroll').gte('created_at', todayStr).limit(200), []),
              safe((sb as any).from('user_events').select('duration_ms').eq('event_type', 'page_view').eq('event_name', 'leave').gte('created_at', todayStr).not('duration_ms', 'is', null).limit(200), []),
            ]);
            const scrollDepths = (scrollR || []).map((r: any) => r.properties?.depth).filter((d: any) => typeof d === 'number');
            const avgScroll = scrollDepths.length > 0 ? Math.round(scrollDepths.reduce((a: number, b: number) => a + b, 0) / scrollDepths.length) : 0;
            const dwells = (dwellR || []).map((r: any) => r.duration_ms).filter((d: any) => typeof d === 'number' && d > 0 && d < 600000);
            const avgDwell = dwells.length > 0 ? Math.round(dwells.reduce((a: number, b: number) => a + b, 0) / dwells.length / 1000) : 0;
            return { eventsToday, avgScroll, avgDwellSec: avgDwell, scrollSamples: scrollDepths.length, dwellSamples: dwells.length };
          } catch { return null; }
        })(),
        trafficDetail: await (async () => {
          const hourAgo = new Date(Date.now() - 3600000).toISOString();
          const [todayPvR, recentPvR] = await Promise.all([
            sb.from('page_views').select('path, created_at, referrer, visitor_id').gte('created_at', todayKST).order('created_at', { ascending: false }).limit(3000),
            sb.from('page_views').select('path, created_at, referrer, visitor_id, user_agent').gte('created_at', hourAgo).order('created_at', { ascending: false }).limit(30),
          ]);
          // top pages today
          const pageCounts: Record<string, number> = {};
          const hourCounts: Record<number, number> = {};
          const visitors = new Set<string>();
          for (const r of (todayPvR.data || [])) {
            const p = r.path || '/';
            pageCounts[p] = (pageCounts[p] || 0) + 1;
            const h = (new Date(r.created_at).getUTCHours() + 9) % 24;
            hourCounts[h] = (hourCounts[h] || 0) + 1;
            if (r.visitor_id) visitors.add(r.visitor_id);
          }
          const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([path, count]) => ({ path, count }));
          // hourly distribution
          const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourCounts[h] || 0 }));
          // 유입경로 집계 (세분화)
          const refMap: Record<string, number> = {};
          for (const r of (todayPvR.data || [])) {
            const source = classifyReferrer(r.referrer);
            if (source !== 'Internal') refMap[source] = (refMap[source] || 0) + 1;
          }
          const referrerBreakdown = Object.entries(refMap)
            .sort((a, b) => b[1] - a[1])
            .map(([source, count]) => ({ source, count }));
          return {
            todayTotal: todayPvR.data?.length || 0,
            uniqueVisitors: visitors.size,
            topPages,
            hourlyPv: hourly,
            referrerBreakdown,
            recentVisitors: (recentPvR.data || []).slice(0, 15).map((r: any) => ({
              path: r.path, at: r.created_at,
              ref: classifyReferrer(r.referrer),
              device: (r.user_agent || '').includes('Mobile') ? '📱' : '💻',
            })),
          };
        })(),
        // ── 대시보드 미니위젯 데이터 ──
        dashboard: {
          recentSignups: (recentSignupsR.data || []).map((u: any) => ({
            nickname: u.nickname, provider: u.provider, source: u.signup_source,
            onboarded: u.onboarded, points: u.points, at: u.created_at,
          })),
          pendingIssues: (pendingIssuesR.data || []).map((i: any) => ({
            id: i.id, title: i.title, category: i.category,
            score: i.final_score, decision: i.publish_decision, at: i.detected_at,
          })),
          recentPosts: (recentPostsR.data || []).map((p: any) => ({
            id: p.id, title: p.title, category: p.category,
            likes: p.likes_count, at: p.created_at,
          })),
          recentComments: (recentCommentsR.data || []).slice(0, 3).map((c: any) => ({
            content: (c.content || '').slice(0, 60), at: c.created_at,
          })),
        },
      });
    }

    // ═══════════════════════════════════════
    // 📊 성장 탭
    // ═══════════════════════════════════════
    if (tab === 'growth') {
      const [pvR, uvR, signupsR, ctaR, topPagesR, hourlyR, dailyPvR, referrerR, signupDailyR] = await Promise.all([
        sb.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        safe(sb.rpc('count_unique_visitors_7d'), 0),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).neq('is_seed', true).neq('is_ghost', true),
        (sb as any).from('conversion_events').select('event_type, cta_name').gte('created_at', weekAgo),
        sb.from('page_views').select('path').gte('created_at', weekAgo),
        sb.from('page_views').select('created_at, user_agent').gte('created_at', weekAgo),
        // 14일 일별 PV/UV 추이
        sb.from('page_views').select('created_at, visitor_id').gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString()),
        // 유입 경로
        sb.from('page_views').select('referrer').gte('created_at', weekAgo),
        // 일별 가입자 추이
        sb.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString()).neq('is_seed', true).neq('is_ghost', true),
      ]);

      // 14일 일별 PV/UV
      const dailyMap: Record<string, { pv: number; visitors: Set<string> }> = {};
      for (const r of (dailyPvR.data || [])) {
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        if (!dailyMap[d]) dailyMap[d] = { pv: 0, visitors: new Set() };
        dailyMap[d].pv++;
        if (r.visitor_id) dailyMap[d].visitors.add(r.visitor_id);
      }
      const dailyTrend = Object.entries(dailyMap)
        .map(([date, v]) => ({ date, pv: v.pv, uv: v.visitors.size }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 유입 경로 분류 (세분화)
      const refCounts: Record<string, number> = {};
      for (const r of (referrerR.data || [])) {
        const source = classifyReferrer(r.referrer);
        if (source !== 'Internal') refCounts[source] = (refCounts[source] || 0) + 1;
      }

      // 일별 가입자 추이
      const signupMap: Record<string, number> = {};
      for (const u of (signupDailyR.data || [])) {
        const d = new Date(u.created_at).toISOString().slice(0, 10);
        signupMap[d] = (signupMap[d] || 0) + 1;
      }
      const signupTrend = Object.entries(signupMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // CTA별 집계
      const ctaStats: Record<string, Record<string, number>> = {};
      for (const e of (ctaR.data || [])) {
        if (!ctaStats[e.cta_name]) ctaStats[e.cta_name] = {};
        ctaStats[e.cta_name][e.event_type] = (ctaStats[e.cta_name][e.event_type] || 0) + 1;
      }

      // 페이지별 집계
      const pageCounts: Record<string, number> = {};
      for (const p of (topPagesR.data || [])) {
        const path = p.path?.split('?')[0] || '/';
        pageCounts[path] = (pageCounts[path] || 0) + 1;
      }
      const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([path, views]) => ({ path, views }));

      // 시간대별 집계
      const hourCounts = new Array(24).fill(0);
      for (const h of (hourlyR.data || [])) {
        const kstHr = (new Date(h.created_at).getUTCHours() + 9) % 24;
        hourCounts[kstHr]++;
      }

      // 기능 사용 히트맵
      const featureUsage = [
        { feature: '블로그', path: '/blog', views: pageCounts['/blog'] || 0 },
        { feature: '부동산', path: '/apt', views: pageCounts['/apt'] || 0 },
        { feature: '종목비교', path: '/stock/compare', views: pageCounts['/stock/compare'] || 0 },
        { feature: '검색', path: '/search', views: pageCounts['/search'] || 0 },
        { feature: '피드', path: '/feed', views: pageCounts['/feed'] || 0 },
        { feature: '주식', path: '/stock', views: pageCounts['/stock'] || 0 },
        { feature: '단지백과', path: '/apt/complex', views: pageCounts['/apt/complex'] || 0 },
        { feature: '토론', path: '/discuss', views: pageCounts['/discuss'] || 0 },
        { feature: '가점계산', path: '/apt/diagnose', views: pageCounts['/apt/diagnose'] || 0 },
        { feature: '계산기', path: '/calc', views: Object.entries(pageCounts).filter(([k]) => k.startsWith('/calc')).reduce((s, [, v]) => s + v, 0) },
      ].sort((a, b) => b.views - a.views);

      // 디바이스 분류
      const deviceCounts: Record<string, number> = { mobile: 0, desktop: 0, bot: 0 };
      for (const h of (hourlyR.data || [])) {
        const ua = (h as any).user_agent || '';
        if (/Mobile|Android|iPhone/i.test(ua)) deviceCounts.mobile++;
        else if (/bot|crawler|spider|Googlebot|Yeti/i.test(ua)) deviceCounts.bot++;
        else deviceCounts.desktop++;
      }

      // 리텐션 코호트 + 가입 귀속 (signup_source)
      const [retentionR, signupSourceR] = await Promise.all([
        (sb as any).from('retention_cohort').select('*').order('cohort_week', { ascending: false }).limit(8),
        sb.from('profiles').select('signup_source').neq('is_seed', true).not('signup_source', 'is', null),
      ]);
      const signupSources: Record<string, number> = {};
      for (const p of (signupSourceR.data || [])) {
        const src = p.signup_source || 'direct';
        signupSources[src] = (signupSources[src] || 0) + 1;
      }

      // 피드 커뮤니티 참여 현황
      const feedStats = await (async () => {
        try {
          const [polls, vs, predicts, shorts, pollVotes, vsVotes, predictVotes, activePolls, pendingPredicts] = await Promise.all([
            safeCount((sb as any).from('post_polls').select('id', { count: 'exact', head: true })),
            safeCount((sb as any).from('vs_battles').select('id', { count: 'exact', head: true })),
            safeCount((sb as any).from('predictions').select('id', { count: 'exact', head: true })),
            safeCount(sb.from('posts').select('id', { count: 'exact', head: true }).eq('post_type', 'short')),
            safeCount((sb as any).from('poll_votes').select('id', { count: 'exact', head: true })),
            safeCount((sb as any).from('vs_votes').select('id', { count: 'exact', head: true })),
            safeCount((sb as any).from('prediction_votes').select('id', { count: 'exact', head: true })),
            safeCount((sb as any).from('post_polls').select('id', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString())),
            safeCount((sb as any).from('predictions').select('id', { count: 'exact', head: true }).eq('resolved', false)),
          ]);
          return { polls, vs, predicts, shorts, pollVotes, vsVotes, predictVotes, activePolls, pendingPredicts, totalVotes: pollVotes + vsVotes + predictVotes };
        } catch { return null; }
      })();

      // ── 전환 개선 추적 지표 (세션 98) ──
      const week7Ago = new Date(Date.now() - 7 * 86400000).toISOString();
      const [aptAlertCta7d, interestNew7d, onboardedTotal, totalRealForRate, regionSetCount, marketingCount, autoOnboarded, manualOnboarded, skipOnboarded, notOnboarded] = await Promise.all([
        // apt_alert_cta 7일 클릭 (BlogAptAlertCTA + SmartSectionGate 통합 소스)
        (sb as any).from('conversion_events').select('event_type').eq('cta_name', 'apt_alert_cta').gte('created_at', week7Ago),
        // apt_site_interests 7일 신규 등록 (알림 CTA 효과 측정)
        (sb as any).from('apt_site_interests').select('id', { count: 'exact', head: true }).gte('created_at', week7Ago),
        // 온보딩 완료 유저
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarded', true).neq('is_seed', true),
        // 전체 실 유저
        sb.from('profiles').select('id', { count: 'exact', head: true }).neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true),
        // 지역 설정 유저
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('residence_city', 'is', null).neq('is_seed', true),
        // 마케팅 동의 유저
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('marketing_agreed', true).neq('is_seed', true),
        // Zero-Step: 자동 온보딩
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_method', 'auto').neq('is_seed', true)),
        // 수동 온보딩
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_method', 'manual').neq('is_seed', true)),
        // 건너뛰기
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_method', 'skip').neq('is_seed', true)),
        // 미온보딩
        safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarded', false).neq('is_seed', true).neq('is_ghost', true)),
      ]);
      const aptAlertCta7dStats = { views: 0, clicks: 0 };
      for (const e of (aptAlertCta7d.data || [])) {
        if (e.event_type === 'cta_view') aptAlertCta7dStats.views++;
        if (e.event_type === 'cta_click') aptAlertCta7dStats.clicks++;
      }
      const conversionMetrics = {
        aptAlertCta7d: aptAlertCta7dStats,
        interestNew7d: interestNew7d.count ?? 0,
        onboardRate: (totalRealForRate.count ?? 0) > 0
          ? Math.round((onboardedTotal.count ?? 0) / (totalRealForRate.count ?? 0) * 100) : 0,
        regionSetRate: (totalRealForRate.count ?? 0) > 0
          ? Math.round((regionSetCount.count ?? 0) / (totalRealForRate.count ?? 0) * 100) : 0,
        marketingRate: (totalRealForRate.count ?? 0) > 0
          ? Math.round((marketingCount.count ?? 0) / (totalRealForRate.count ?? 0) * 100) : 0,
        contentGate7d: ctaStats['content_gate'] || { cta_view: 0, cta_click: 0 },
        blogInlineCta7d: ctaStats['blog_inline_cta'] || { cta_view: 0, cta_click: 0 },
        // Zero-Step 온보딩 분포
        zeroStep: { auto: autoOnboarded, manual: manualOnboarded, skip: skipOnboarded, notOnboarded },
      };

      // ── Source별 가입 퍼널 (30일) ──
      const { data: signupFunnelRaw } = await (sb as any).from('signup_attempts')
        .select('source, success')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      const signupFunnel: Record<string, { attempts: number; completions: number }> = {};
      for (const r of (signupFunnelRaw || [])) {
        const src = r.source || 'direct';
        if (!signupFunnel[src]) signupFunnel[src] = { attempts: 0, completions: 0 };
        signupFunnel[src].attempts++;
        if (r.success) signupFunnel[src].completions++;
      }

      // ── Device별 전환 (7일) ──
      const { data: deviceConvRaw } = await (sb as any).from('conversion_events')
        .select('device_type, event_type')
        .gte('created_at', week7Ago)
        .in('event_type', ['cta_view', 'cta_click']);
      const deviceConv: Record<string, { views: number; clicks: number }> = {};
      for (const r of (deviceConvRaw || [])) {
        const dt = r.device_type || 'unknown';
        if (!deviceConv[dt]) deviceConv[dt] = { views: 0, clicks: 0 };
        if (r.event_type === 'cta_view') deviceConv[dt].views++;
        else if (r.event_type === 'cta_click') deviceConv[dt].clicks++;
      }

      // ── Ghost CTA 필터링 ──
      const ACTIVE_CTAS = new Set([
        'content_gate', 'blog_inline_cta', 'action_bar_kakao',
        'apt_alert_cta', 'login_gate_apt_analysis', 'login_gate_ai_analysis',
        'content_lock', 'kakao_hero', 'calc_cta', 'right_panel', 'sidebar',
      ]);
      const activeCtaStats: Record<string, Record<string, number>> = {};
      let ghostCtaCount = 0;
      for (const [name, events] of Object.entries(ctaStats)) {
        if (ACTIVE_CTAS.has(name)) {
          activeCtaStats[name] = events as Record<string, number>;
        } else {
          ghostCtaCount += ((events as any).cta_view || 0);
        }
      }

      // ── 재개발 현황 ──
      const [redevTotalR, redevResidentialR, redevDosiR, redevWithHHR, redevWithGeoR, redevWithAiR, redevWithConstructorR] = await Promise.all([
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('sub_type', '도시환경정비'),
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('sub_type', '도시환경정비'),
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).not('total_households', 'is', null).gt('total_households', 0),
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).not('latitude', 'is', null),
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).not('ai_summary', 'is', null),
        (sb as any).from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).not('constructor', 'is', null),
      ]);
      const redevStats = {
        total: redevTotalR.count ?? 0,
        residential: redevResidentialR.count ?? 0,
        dosi: redevDosiR.count ?? 0,
        withHouseholds: redevWithHHR.count ?? 0,
        withGeo: redevWithGeoR.count ?? 0,
        withAi: redevWithAiR.count ?? 0,
        withConstructor: redevWithConstructorR.count ?? 0,
      };

      return NextResponse.json({
        deviceSplit: deviceCounts,
        funnel: {
          pv: pvR.count ?? 0,
          uv: uvR ?? 0,
          signups: signupsR.count ?? 0,
          conversionRate: (pvR.count ?? 0) > 0 ? Math.round(((signupsR.count ?? 0) / (pvR.count ?? 0)) * 10000) / 100 : 0,
          onboarded: await safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarded', true).neq('is_seed', true).neq('is_ghost', true)),
          profileCompleted: await safeCount(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('profile_completed', true).neq('is_seed', true).neq('is_ghost', true)),
        },
        ctaStats: activeCtaStats,
        ghostCtaCount,
        topPages,
        hourlyTraffic: hourCounts,
        featureUsage,
        dailyTrend,
        referrers: refCounts,
        signupTrend,
        retentionCohort: retentionR.data || [],
        signupSources,
        feedStats,
        conversionMetrics,
        signupFunnel,
        deviceConv,
        redevStats,
      });
    }

    // ═══════════════════════════════════════
    // 👤 사용자 탭
    // ═══════════════════════════════════════
    if (tab === 'users') {
      const [realUsersR, interestsR, bookmarksR, watchlistR, searchesR, sharesR, pwaR, totalRealR, emailSubsR] = await Promise.all([
        sb.from('profiles')
          .select('id, nickname, provider, created_at, last_active_at, grade, points, residence_city, residence_district, onboarded, profile_completed, interests, is_seed, first_mission_completed, signup_source, gender, age_group, birth_year, marketing_agreed, is_premium, streak_days, influence_score')
          .neq('is_ghost', true).neq('is_deleted', true)
          .order('created_at', { ascending: false }).limit(200),
        sb.from('apt_site_interests')
          .select('site_id, guest_name, guest_city, is_member, created_at, notification_enabled')
          .order('created_at', { ascending: false }).limit(10),
        sb.from('bookmarks').select('user_id', { count: 'exact', head: true }),
        sb.from('stock_watchlist').select('id', { count: 'exact', head: true }),
        sb.from('search_logs').select('id', { count: 'exact', head: true }),
        sb.from('share_logs').select('id', { count: 'exact', head: true }),
        sb.from('pwa_installs').select('id', { count: 'exact', head: true }),
        sb.from('profiles').select('id', { count: 'exact', head: true }).neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true),
        safeCount((sb as any).from('email_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true)),
      ]);

      // 유저별 활동 카운트 (실유저만)
      const realUsers = (realUsersR.data || []).filter((u: any) => !u.is_seed);
      const userIds = realUsers.map((u: any) => u.id);
      
      let postsCounts: Record<string, number> = {};
      let commentsCounts: Record<string, number> = {};
      let watchlistCounts: Record<string, number> = {};
      let aptBmCounts: Record<string, number> = {};
      let blogBmCounts: Record<string, number> = {};
      let attendCounts: Record<string, number> = {};

      if (userIds.length > 0) {
        const [postsR, commentsR, wlR, abR, bbR, attR] = await Promise.all([
          sb.from('posts').select('author_id').in('author_id', userIds).eq('is_deleted', false),
          sb.from('comments').select('author_id').in('author_id', userIds),
          sb.from('stock_watchlist').select('user_id').in('user_id', userIds),
          (sb as any).from('apt_bookmarks').select('user_id').in('user_id', userIds),
          (sb as any).from('blog_bookmarks').select('user_id').in('user_id', userIds),
          sb.from('attendance').select('user_id').in('user_id', userIds),
        ]);
        for (const r of (postsR.data || [])) postsCounts[r.author_id] = (postsCounts[r.author_id] || 0) + 1;
        for (const r of (commentsR.data || [])) commentsCounts[r.author_id] = (commentsCounts[r.author_id] || 0) + 1;
        for (const r of (wlR.data || [])) watchlistCounts[r.user_id] = (watchlistCounts[r.user_id] || 0) + 1;
        for (const r of (abR.data || [])) aptBmCounts[r.user_id] = (aptBmCounts[r.user_id] || 0) + 1;
        for (const r of (bbR.data || [])) blogBmCounts[r.user_id] = (blogBmCounts[r.user_id] || 0) + 1;
        for (const r of (attR.data || [])) attendCounts[r.user_id] = (attendCounts[r.user_id] || 0) + 1;
      }

      // 유저에 활동 카운트 병합
      const enrichedUsers = (realUsersR.data || []).map((u: any) => ({
        ...u,
        posts_count: postsCounts[u.id] || 0,
        comments_count: commentsCounts[u.id] || 0,
        watchlist_count: watchlistCounts[u.id] || 0,
        apt_bm_count: aptBmCounts[u.id] || 0,
        blog_bm_count: blogBmCounts[u.id] || 0,
        attendance_count: attendCounts[u.id] || 0,
      }));

      // 관심단지 현장명 조인
      const interests = interestsR.data || [];
      const siteIds = interests.map((i: any) => i.site_id).filter(Boolean);
      let siteNames: Record<string, { name: string; region: string }> = {};
      if (siteIds.length > 0) {
        const { data: sites } = await sb.from('apt_sites').select('id, name, region').in('id', siteIds);
        for (const s of (sites || [])) {
          siteNames[s.id] = { name: s.name, region: s.region };
        }
      }

      // 북마크 사용자별 집계
      const { data: bookmarkUsers } = await sb.from('bookmarks')
        .select('user_id')
        .order('created_at', { ascending: false });
      const bmUserCounts: Record<string, number> = {};
      for (const b of (bookmarkUsers || [])) {
        bmUserCounts[b.user_id] = (bmUserCounts[b.user_id] || 0) + 1;
      }
      const bookmarkUserCount = Object.keys(bmUserCounts).length;

      // 가입 경로 + 등급 분포 분석
      const providers: Record<string, number> = {};
      const cities: Record<string, number> = {};
      const grades: Record<number, number> = {};
      let onboardedCount = 0;
      let profileCompleted = 0;
      let returningCount = 0;
      for (const u of (realUsersR.data || [])) {
        providers[u.provider || 'unknown'] = (providers[u.provider || 'unknown'] || 0) + 1;
        if (u.residence_city) cities[u.residence_city] = (cities[u.residence_city] || 0) + 1;
        grades[u.grade || 1] = (grades[u.grade || 1] || 0) + 1;
        if (u.onboarded) onboardedCount++;
        if (u.profile_completed) profileCompleted++;
        if (u.last_active_at) returningCount++;
      }

      return NextResponse.json({
        users: enrichedUsers,
        lifecycle: {
          total: totalRealR.count ?? (realUsersR.data || []).length,
          onboarded: onboardedCount,
          profileCompleted,
          returning: returningCount,
          providers,
          cities: Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 8),
          grades: Object.entries(grades).sort((a, b) => Number(a[0]) - Number(b[0])).map(([g, c]) => ({ grade: Number(g), count: c })),
        },
        interests: interests.map((i: any) => ({
          ...i,
          siteName: siteNames[i.site_id]?.name || '알 수 없음',
          siteRegion: siteNames[i.site_id]?.region || '',
        })),
        engagement: {
          bookmarks: bookmarksR.count ?? 0,
          bookmarkUsers: bookmarkUserCount,
          stockWatch: watchlistR.count ?? 0,
          searches: searchesR.count ?? 0,
          shares: sharesR.count ?? 0,
          pwaInstalls: pwaR.count ?? 0,
          emailSubs: emailSubsR,
        },
      });
    }

    // ═══════════════════════════════════════
    // 🗄️ 데이터 탭
    // ═══════════════════════════════════════
    if (tab === 'data') {
      // 크론별 마지막 성공 시각 (데이터 신선도)
      const { data: freshness } = await sb.from('cron_logs')
        .select('cron_name, created_at, records_processed')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(200);

      const lastSuccess: Record<string, { at: string; records: number }> = {};
      for (const f of (freshness || [])) {
        if (!lastSuccess[f.cron_name]) {
          lastSuccess[f.cron_name] = { at: f.created_at, records: f.records_processed || 0 };
        }
      }

      // 블로그 카테고리별 품질
      let blogCats = null;
      try { const r = await sb.rpc('blog_category_stats'); blogCats = r.data; } catch { /* ignore */ }

      // 주식 데이터 커버리지
      const [stockTotal, stockActive, stockSector, stockDesc] = await Promise.all([
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).gt('price', 0),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).not('sector', 'is', null).neq('sector', ''),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).not('description', 'is', null).neq('description', ''),
      ]);

      // 부동산 데이터 커버리지
      const [aptSites, aptWithImages, aptTx, rentTx, complexR] = await Promise.all([
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).not('images', 'is', null),
        sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
        sb.from('apt_rent_transactions').select('id', { count: 'exact', head: true }),
        sb.from('apt_complex_profiles').select('apt_name', { count: 'exact', head: true }),
      ]);

      // SEO 허브 페이지 통계
      let seoHubs = { sigungu: 0, dong: 0, builder: 0, themes: 6, dataQuality: { coords: 0, priceChange: 0, pyeong: 0, blogLink: 0, households: 0 } };
      try {
        const { data: sgd } = await (sb as any).from('apt_complex_profiles').select('sigungu').not('age_group', 'is', null).not('sigungu', 'is', null);
        const sgMap = new Map<string, number>();
        for (const r of (sgd || [])) { if (r.sigungu) sgMap.set(r.sigungu, (sgMap.get(r.sigungu) || 0) + 1); }
        seoHubs.sigungu = Array.from(sgMap.values()).filter(c => c >= 10).length;

        const { data: dd } = await (sb as any).from('apt_complex_profiles').select('dong').not('age_group', 'is', null).not('dong', 'is', null).neq('dong', '');
        const dMap = new Map<string, number>();
        for (const r of (dd || [])) { if (r.dong) dMap.set(r.dong, (dMap.get(r.dong) || 0) + 1); }
        seoHubs.dong = Array.from(dMap.values()).filter(c => c >= 5).length;

        const { data: bd } = await sb.from('apt_sites').select('builder').eq('is_active', true).not('builder', 'is', null).neq('builder', '');
        const bMap = new Map<string, number>();
        for (const r of (bd || [])) { if (r.builder) bMap.set(r.builder, (bMap.get(r.builder) || 0) + 1); }
        seoHubs.builder = Array.from(bMap.values()).filter(c => c >= 3).length;

        const { data: dq } = await (sb as any).from('apt_complex_profiles')
          .select('latitude, price_change_1y, avg_sale_price_pyeong, blog_post_count, total_households');
        const dqArr = dq || [];
        seoHubs.dataQuality = {
          coords: dqArr.filter((d: any) => d.latitude != null).length,
          priceChange: dqArr.filter((d: any) => d.price_change_1y != null).length,
          pyeong: dqArr.filter((d: any) => d.avg_sale_price_pyeong > 0).length,
          blogLink: dqArr.filter((d: any) => d.blog_post_count > 0).length,
          households: dqArr.filter((d: any) => d.total_households > 0).length,
        };
      } catch {}

      // 선점 콘텐츠 파이프라인
      const upcomingRaw = await (sb as any).from('upcoming_projects')
        .select('status, blog_post_id, region');
      const upList = upcomingRaw.data || [];
      const upStats = {
        total: upList.length,
        published: upList.filter((u: any) => u.blog_post_id).length,
        pending: upList.filter((u: any) => !u.blog_post_id).length,
        byRegion: {} as Record<string, number>,
      };
      for (const u of upList) {
        const r = u.region || '기타';
        upStats.byRegion[r] = (upStats.byRegion[r] || 0) + 1;
      }

      return NextResponse.json({
        freshness: lastSuccess,
        stock: {
          total: stockTotal.count ?? 0,
          active: stockActive.count ?? 0,
          withSector: stockSector.count ?? 0,
          withDesc: stockDesc.count ?? 0,
        },
        realestate: {
          sites: aptSites.count ?? 0,
          withImages: aptWithImages.count ?? 0,
          transactions: aptTx.count ?? 0,
          rentTransactions: rentTx.count ?? 0,
          complexProfiles: complexR.count ?? 0,
          seoHubs,
        },
        blogCategories: blogCats,
        upcoming: upStats,
      });
    }

    // ═══════════════════════════════════════
    // 🔧 운영 탭
    // ═══════════════════════════════════════
    if (tab === 'ops') {
      // 크론 그룹별 성공/실패
      const { data: cronLogs } = await sb.from('cron_logs')
        .select('cron_name, status, duration_ms, error_message, created_at')
        .gte('created_at', dayAgo)
        .order('created_at', { ascending: false });

      const groups: Record<string, { ok: number; fail: number; crons: Set<string> }> = {
        data: { ok: 0, fail: 0, crons: new Set() },
        process: { ok: 0, fail: 0, crons: new Set() },
        ai: { ok: 0, fail: 0, crons: new Set() },
        content: { ok: 0, fail: 0, crons: new Set() },
        system: { ok: 0, fail: 0, crons: new Set() },
        alert: { ok: 0, fail: 0, crons: new Set() },
      };

      const cronClassify = (name: string): string => {
        if (name.startsWith('crawl-') || name.startsWith('stock-crawl') || name.startsWith('stock-discover') || name === 'exchange-rate' || name.startsWith('stock-news') || name.startsWith('stock-flow') || name.startsWith('invest-')) return 'data';
        if (name.startsWith('sync-') || name.startsWith('naver-') || name.startsWith('auto-') || name.startsWith('aggregate') || name.startsWith('apt-parse') || name.startsWith('apt-price') || name.startsWith('apt-backfill')) return 'process';
        if (name.startsWith('blog-stock') || name.startsWith('blog-apt-v') || name.startsWith('apt-ai') || name.startsWith('stock-daily-briefing') || name.startsWith('post-ai') || name === 'blog-rewrite') return 'ai';
        if (name.startsWith('blog-') || name.startsWith('seed-')) return 'content';
        if (name.startsWith('push-') || name.startsWith('check-')) return 'alert';
        return 'system';
      };

      for (const log of (cronLogs || [])) {
        const g = cronClassify(log.cron_name);
        if (groups[g]) {
          groups[g].crons.add(log.cron_name);
          if (log.status === 'success') groups[g].ok++;
          else groups[g].fail++;
        }
      }

      // Set → number 변환
      const groupStats = Object.fromEntries(
        Object.entries(groups).map(([k, v]) => [k, { ok: v.ok, fail: v.fail, cronCount: v.crons.size }])
      );


    // 실패 크론 상세
      const failDetails: Record<string, { count: number; lastError: string; lastAt: string }> = {};
      for (const log of (cronLogs || [])) {
        if (log.status === 'failed') {
          if (!failDetails[log.cron_name]) {
            failDetails[log.cron_name] = { count: 0, lastError: log.error_message || '', lastAt: log.created_at };
          }
          failDetails[log.cron_name].count++;
        }
      }

      // DB 크기
      const dbMb = await safe(sb.rpc('get_db_size_mb'), 0);

      // 최근 크론 실행 10건
      const { data: recentCrons } = await sb.from('cron_logs')
        .select('cron_name, status, duration_ms, records_processed, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      return NextResponse.json({
        cronGroups: groupStats,
        failedCrons: failDetails,
        totalOk: (cronLogs || []).filter((l: any) => l.status === 'success').length,
        totalFail: (cronLogs || []).filter((l: any) => l.status === 'failed').length,
        dbMb,
        recentCrons: (recentCrons || []).map((c: any) => ({
          name: c.cron_name, status: c.status,
          duration: c.duration_ms ? Math.round(c.duration_ms / 1000 * 10) / 10 : null,
          records: c.records_processed, at: c.created_at,
        })),
      });
    }

    return NextResponse.json({ error: 'Unknown tab' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[admin-v2]', tab, errMsg(e));
    return NextResponse.json({ error: errMsg(e), tab }, { status: 500 });
  }
}

