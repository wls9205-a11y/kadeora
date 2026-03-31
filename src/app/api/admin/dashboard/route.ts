import { errMsg } from '@/lib/error-utils';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sanitizeSearchQuery } from '@/lib/sanitize';

export const maxDuration = 30;

/**
 * 통합 어드민 대시보드 API
 * GET /api/admin/dashboard?section=overview|users|content|blog|realestate|system
 * 
 * overview: 전체 KPI + 최근 활동
 * users: 유저 목록 + 상세
 * content: 게시글 + 댓글 + 채팅
 * blog: 블로그 통계 + 리라이팅 현황
 * realestate: 부동산 현장 + 청약 + 미분양 + 재개발
 * system: 크론 + 인프라 + 헬스체크
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase: sb } = auth;

  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section') || 'overview';

  try {
    if (section === 'overview') {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [
        usersR, postsR, blogR, stockR, aptR, sitesR, interestsR,
        unsoldR, redevR, tradeR, paymentsR, reportsR, dailyR,
        newUsersWeekR, activeUsersR, discussR, cronR,
      ] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_site_interests').select('id', { count: 'exact', head: true }),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
        sb.from('payments').select('id, amount, status, created_at').order('created_at', { ascending: false }).limit(10),
        sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('daily_stats').select('*').order('stat_date', { ascending: false }).limit(14),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active_at', weekAgo),
        sb.from('discussion_topics').select('id', { count: 'exact', head: true }),
        sb.from('cron_logs').select('cron_name, status, duration_ms, created_at')
          .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .order('created_at', { ascending: false }).limit(200),
      ]);

      // 주식 상세 KPI (추가)
      const [stockActiveR, stockPriceHistR, stockBriefingKR, stockBriefingUS, stockNewsR, stockMarketCapR, stockNoSectorR, stockNoVolumeR, stockNoDescR] = await Promise.all([
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).gt('price', 0),
        sb.from('stock_price_history').select('symbol', { count: 'exact', head: true }),
        sb.from('stock_daily_briefing').select('briefing_date').eq('market', 'KR').order('briefing_date', { ascending: false }).limit(1).maybeSingle(),
        sb.from('stock_daily_briefing').select('briefing_date').eq('market', 'US').order('briefing_date', { ascending: false }).limit(1).maybeSingle(),
        sb.from('stock_news').select('id', { count: 'exact', head: true }),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).gt('market_cap', 0),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).or('sector.is.null,sector.eq.').gt('price', 0).eq('is_active', true),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).or('volume.is.null,volume.eq.0').gt('price', 0).eq('is_active', true),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).or('description.is.null,description.eq.').gt('price', 0).eq('is_active', true),
      ]);
      const stockKpi = {
        total: stockR.count ?? 0,
        active: stockActiveR.count ?? 0,
        priceHistory: stockPriceHistR.count ?? 0,
        lastKRBriefing: stockBriefingKR.data?.briefing_date ?? null,
        lastUSBriefing: stockBriefingUS.data?.briefing_date ?? null,
        newsCount: stockNewsR.count ?? 0,
        withMarketCap: stockMarketCapR.count ?? 0,
        noSector: stockNoSectorR.count ?? 0,
        noVolume: stockNoVolumeR.count ?? 0,
        noDesc: stockNoDescR.count ?? 0,
      };

      // 주식 시세 건강도
      const [zeroPctR, abnormalPctR, kospiR, kosdaqR] = await Promise.all([
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('change_pct', 0).gt('price', 0).eq('is_active', true).neq('sector', '지수'),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).gt('change_pct', 30).eq('is_active', true),
        sb.from('stock_quotes').select('price, change_pct').eq('symbol', 'KOSPI_IDX').maybeSingle(),
        sb.from('stock_quotes').select('price, change_pct').eq('symbol', 'KOSDAQ_IDX').maybeSingle(),
      ]);
      const stockHealth = {
        zeroPct: zeroPctR.count ?? 0,
        abnormalPct: abnormalPctR.count ?? 0,
        kospiPrice: kospiR.data?.price ?? 0,
        kospiPct: kospiR.data?.change_pct ?? 0,
        kosdaqPrice: kosdaqR.data?.price ?? 0,
        kosdaqPct: kosdaqR.data?.change_pct ?? 0,
      };

      // 단지백과 KPI
      const [complexTotalR, complexWithSaleR, complexWithJeonseR, complexWithCoordsR, rentTotalR] = await Promise.all([
        (sb as any).from('apt_complex_profiles').select('id', { count: 'exact', head: true }),
        (sb as any).from('apt_complex_profiles').select('id', { count: 'exact', head: true }).gt('latest_sale_price', 0),
        (sb as any).from('apt_complex_profiles').select('id', { count: 'exact', head: true }).gt('latest_jeonse_price', 0),
        (sb as any).from('apt_complex_profiles').select('id', { count: 'exact', head: true }).not('latitude', 'is', null),
        (sb as any).from('apt_rent_transactions').select('id', { count: 'exact', head: true }),
      ]);
      const complexKpi = {
        totalProfiles: complexTotalR.count ?? 0,
        withSale: complexWithSaleR.count ?? 0,
        withJeonse: complexWithJeonseR.count ?? 0,
        withCoords: complexWithCoordsR.count ?? 0,
        rentTransactions: rentTotalR.count ?? 0,
        saleTransactions: tradeR.count ?? 0,
      };

      // 프리미엄 & 매출 KPI
      const [premiumR, premiumExpiringR, revenueR, ordersR, indexNowTotalR, indexNowDoneR] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_premium', true),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_premium', true).lt('premium_expires_at', new Date(Date.now() + 7 * 86400000).toISOString()),
        sb.from('shop_orders').select('amount').eq('status', 'DONE'),
        sb.from('shop_orders').select('id', { count: 'exact', head: true }).eq('status', 'DONE'),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).not('indexed_at', 'is', null),
      ]);
      const totalRevenue = (revenueR.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const premiumKpi = {
        subscribers: premiumR.count ?? 0,
        expiringSoon: premiumExpiringR.count ?? 0,
        totalRevenue,
        totalOrders: ordersR.count ?? 0,
        indexNow: {
          total: indexNowTotalR.count ?? 0,
          done: indexNowDoneR.count ?? 0,
          pending: (indexNowTotalR.count ?? 0) - (indexNowDoneR.count ?? 0),
          pct: indexNowTotalR.count ? Math.round(((indexNowDoneR.count ?? 0) / indexNowTotalR.count) * 100) : 0,
        },
      };

      // 데이터 커버리지 KPI
      const [aptPriceR, aptCoordsR, stockDescR, aptCrawlLastR, aptImagesR, aiSummaryAccurateR, stockRefreshR] = await Promise.all([
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).gt('price_min', 0),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).not('latitude', 'is', null),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).neq('description', '').not('description', 'is', null),
        sb.from('cron_logs').select('created_at, status, records_created, error_message').eq('cron_name', 'apt-crawl-pricing').order('created_at', { ascending: false }).limit(5),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).or('images.neq.[],og_image_url.neq.'),
        // ai_summary 정확도 (총·일반·특별 포함 = 정확)
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }).like('ai_summary', '%총%세대%일반%특별%'),
        // stock-refresh 최근 실행
        sb.from('cron_logs').select('created_at, status').eq('cron_name', 'stock-refresh').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      // DB 크기 조회
      let dbSizeStr = '?';
      try {
        const { data: dbSizeData } = await (sb as any).rpc('get_db_size');
        dbSizeStr = dbSizeData || '?';
      } catch { dbSizeStr = '?'; }
      const dataCoverage = {
        aptPrice: { done: aptPriceR.count ?? 0, total: sitesR.count ?? 0, pct: sitesR.count ? Math.round(((aptPriceR.count ?? 0) / (sitesR.count ?? 1)) * 100) : 0 },
        aptCoords: { done: aptCoordsR.count ?? 0, total: sitesR.count ?? 0, pct: sitesR.count ? Math.round(((aptCoordsR.count ?? 0) / (sitesR.count ?? 1)) * 100) : 0 },
        aptImages: { done: aptImagesR.count ?? 0, total: sitesR.count ?? 0, pct: sitesR.count ? Math.round(((aptImagesR.count ?? 0) / (sitesR.count ?? 1)) * 100) : 0 },
        stockDesc: { done: stockDescR.count ?? 0, total: stockR.count ?? 0, pct: stockR.count ? Math.round(((stockDescR.count ?? 0) / (stockR.count ?? 1)) * 100) : 0 },
        aiSummary: { done: aiSummaryAccurateR.count ?? 0, total: aptR.count ?? 0, pct: aptR.count ? Math.round(((aiSummaryAccurateR.count ?? 0) / (aptR.count ?? 1)) * 100) : 0 },
        stockRefresh: stockRefreshR.data ? { lastAt: stockRefreshR.data.created_at, ok: stockRefreshR.data.status === 'success' } : null,
        aptCrawlRecent: (aptCrawlLastR.data || []).map((r: any) => ({ at: r.created_at, ok: r.status === 'success', created: r.records_created ?? 0, err: r.error_message?.slice(0, 60) })),
        dbSize: dbSizeStr,
      };

      // 최근 가입 유저 5명
      const { data: recentUsers } = await sb.from('profiles')
        .select('id, nickname, provider, created_at, grade, is_seed, region_text')
        .order('created_at', { ascending: false }).limit(5);

      // 방문자 요약 (관리자 제외)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const adminIds = ['265d8c3b-bd40-40c1-b7d2-bdde16a88204', 'b7b4dd42-4685-4ca6-9ee3-dfedf82e86f2'];
      const [pvTodayR, pvWeekR] = await Promise.all([
        sb.from('page_views').select('visitor_id').gte('created_at', todayStart),
        sb.from('page_views').select('visitor_id, path, referrer').gte('created_at', weekAgo),
      ]);
      const pvTodayFiltered = (pvTodayR.data || []);
      const pvWeekFiltered = (pvWeekR.data || []);
      const todayPV = pvTodayFiltered.length;
      const todayUV = new Set(pvTodayFiltered.map((v: { visitor_id?: string }) => v.visitor_id)).size;
      const weekPV = pvWeekFiltered.length;
      const weekUV = new Set(pvWeekFiltered.map((v: { visitor_id?: string }) => v.visitor_id)).size;
      // Top referrer
      const extRef: Record<string, number> = {};
      pvWeekFiltered.forEach((v: any) => {
        if (!v.referrer) return;
        try { const h = new URL(v.referrer).hostname; if (!h.includes('kadeora')) extRef[h.replace('www.','')] = (extRef[h.replace('www.','')] || 0) + 1; } catch {}
      });
      const topReferrer = Object.entries(extRef).sort((a,b) => b[1]-a[1])[0] || ['없음', 0];

      // 최근 게시글 5건
      const { data: recentPosts } = await sb.from('posts')
        .select('id, title, category, likes_count, comments_count, created_at, profiles!inner(nickname)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }).limit(5);

      // 활동 피드: 최근 댓글 + 신고 혼합
      const [recentCommentsR, recentReportsR] = await Promise.all([
        sb.from('comments').select('id, content, created_at, profiles!inner(nickname)').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
        sb.from('reports').select('id, reason, content_type, created_at, profiles!reports_reporter_id_fkey(nickname)').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
      ]);

      // 크론 요약
      const cronData = cronR.data || [];
      const cronSuccess = cronData.filter(c => c.status === 'success').length;
      const cronFail = cronData.filter(c => c.status === 'failed').length;

      // content_score 분포 + SEO 현황
      const { data: scoreStats } = await sb.from('apt_sites')
        .select('site_type, content_score, sitemap_wave')
        .eq('is_active', true);

      const siteTypeBreakdown: Record<string, { count: number; avgScore: number; sitemapCount: number }> = {};
      let totalSitemap = 0;
      for (const s of (scoreStats || [])) {
        const t = s.site_type || 'unknown';
        if (!siteTypeBreakdown[t]) siteTypeBreakdown[t] = { count: 0, avgScore: 0, sitemapCount: 0 };
        siteTypeBreakdown[t].count++;
        siteTypeBreakdown[t].avgScore += s.content_score ?? 0;
        if ((s.content_score ?? 0) >= 25) { siteTypeBreakdown[t].sitemapCount++; totalSitemap++; }
      }
      for (const t of Object.keys(siteTypeBreakdown)) {
        siteTypeBreakdown[t].avgScore = Math.round(siteTypeBreakdown[t].avgScore / siteTypeBreakdown[t].count);
      }

      // 크론 실패 상세 (어떤 크론이 실패했는지)
      const cronFails = cronData.filter(c => c.status === 'failed');
      const cronFailNames = [...new Set(cronFails.map(c => c.cron_name))].slice(0, 5);

      // Anthropic 크레딧 부족 감지: blog 크론 연속 0건 생성 시 경고
      const blogCronData = cronData.filter(c => c.cron_name && c.cron_name.startsWith('blog-'));
      const blogCronFails = blogCronData.filter(c => c.status === 'failed').length;
      const blogCronTotal = blogCronData.length;
      const anthropicCreditWarning = blogCronTotal > 0 && (blogCronFails / blogCronTotal) > 0.5;

      // 블로그 리라이팅 현황
      const { data: blogStats } = await sb.from('blog_posts')
        .select('rewritten_at', { count: 'exact' })
        .eq('is_published', true)
        .not('rewritten_at', 'is', null);
      const blogRewrittenPct = blogR.count ? Math.round(((blogStats?.length || 0) / blogR.count) * 100) : 0;

      // ── 추가 데이터: 어제 대비 + 인기 페이지 + 크론 상세 + 카테고리 분포 ──
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const yesterdayEnd = todayStart;

      const [pvYesterdayR, postsYesterdayR, commentsYesterdayR, newUsersYesterdayR] = await Promise.all([
        sb.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', yesterdayEnd),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', yesterdayStart).lt('created_at', yesterdayEnd),
        sb.from('comments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', yesterdayStart).lt('created_at', yesterdayEnd),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', yesterdayEnd),
      ]);

      // 인기 페이지 TOP 5
      const pathMap = new Map<string, number>();
      pvTodayFiltered.forEach((v: any) => { if (v.path) pathMap.set(v.path, (pathMap.get(v.path) || 0) + 1); });
      const topPages = [...pathMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, count]) => ({ path, count }));

      // 카테고리별 게시글 분포 (전체)
      const { data: catDist } = await sb.from('posts').select('category').eq('is_deleted', false);
      const catMap = new Map<string, number>();
      (catDist || []).forEach((p: any) => { catMap.set(p.category || 'free', (catMap.get(p.category || 'free') || 0) + 1); });
      const categoryDistribution = [...catMap.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }));

      // 크론 상세: 크론별 마지막 실행 + 24h records_created
      const cronSummary: Record<string, { lastRun: string; success: number; total: number; created: number }> = {};
      for (const c of cronData) {
        if (!cronSummary[c.cron_name]) cronSummary[c.cron_name] = { lastRun: c.created_at || '', success: 0, total: 0, created: 0 };
        cronSummary[c.cron_name].total++;
        if (c.status === 'success') cronSummary[c.cron_name].success++;
      }
      // records_created 합산
      const { data: cronCreated } = await sb.from('cron_logs')
        .select('cron_name, records_created')
        .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
        .gt('records_created', 0);
      for (const c of (cronCreated || [])) {
        if (cronSummary[c.cron_name]) cronSummary[c.cron_name].created += c.records_created || 0;
      }
      const totalRecordsCreated = Object.values(cronSummary).reduce((s, v) => s + v.created, 0);

      // ── 추가: 블로그 생산 + 댓글 + 크론 카테고리 ──
      const [blogTodayR, blogCatR, commentsTodayR, repliesR, blogQueueR, blogUnpubR] = await Promise.all([
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).gte('published_at', todayStr),
        sb.from('blog_posts').select('category').eq('is_published', true),
        sb.from('comments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', todayStart),
        sb.from('comments').select('id', { count: 'exact', head: true }).not('parent_id', 'is', null),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', false),
        sb.from('blog_posts').select('id, content', { count: 'exact' }).eq('is_published', false).limit(500),
      ]);

      // 블로그 카테고리 분포
      const blogCatMap: Record<string, number> = {};
      (blogCatR.data || []).forEach((b: any) => { blogCatMap[b.category || 'general'] = (blogCatMap[b.category || 'general'] || 0) + 1; });

      // 크론 카테고리별 분류
      const cronByCategory: Record<string, { success: number; fail: number; total: number; created: number }> = {
        blog: { success: 0, fail: 0, total: 0, created: 0 },
        stock: { success: 0, fail: 0, total: 0, created: 0 },
        apt: { success: 0, fail: 0, total: 0, created: 0 },
        system: { success: 0, fail: 0, total: 0, created: 0 },
      };
      for (const c of cronData) {
        const cat = c.cron_name?.startsWith('blog-') || c.cron_name?.startsWith('seed-') ? 'blog'
          : c.cron_name?.startsWith('stock-') ? 'stock'
          : c.cron_name?.includes('apt') || c.cron_name?.includes('redev') || c.cron_name?.includes('unsold') || c.cron_name?.includes('subscription') || c.cron_name?.includes('trade') ? 'apt'
          : 'system';
        cronByCategory[cat].total++;
        if (c.status === 'success') cronByCategory[cat].success++;
        else cronByCategory[cat].fail++;
      }
      for (const [name, info] of Object.entries(cronSummary)) {
        const cat = name.startsWith('blog-') || name.startsWith('seed-') ? 'blog'
          : name.startsWith('stock-') ? 'stock'
          : name.includes('apt') || name.includes('redev') || name.includes('unsold') || name.includes('subscription') || name.includes('trade') ? 'apt'
          : 'system';
        cronByCategory[cat].created += info.created;
      }

      return NextResponse.json({
        kpi: {
          users: usersR.count ?? 0,
          posts: postsR.count ?? 0,
          blogs: blogR.count ?? 0,
          stocks: stockR.count ?? 0,
          subscriptions: aptR.count ?? 0,
          sites: sitesR.count ?? 0,
          interests: interestsR.count ?? 0,
          unsold: unsoldR.count ?? 0,
          redev: redevR.count ?? 0,
          trades: tradeR.count ?? 0,
          discussions: discussR.count ?? 0,
          pendingReports: reportsR.count ?? 0,
          newUsersWeek: newUsersWeekR.count ?? 0,
          activeUsersWeek: activeUsersR.count ?? 0,
        },
        visitors: { todayPV, todayUV, weekPV, weekUV, topReferrer: { source: topReferrer[0], count: topReferrer[1] } },
        yesterday: {
          pv: pvYesterdayR.count ?? 0,
          posts: postsYesterdayR.count ?? 0,
          comments: commentsYesterdayR.count ?? 0,
          newUsers: newUsersYesterdayR.count ?? 0,
        },
        topPages,
        categoryDistribution,
        cronDetail: cronSummary,
        totalRecordsCreated,
        dbSize: dataCoverage.dbSize || '?',
        recentUsers: recentUsers ?? [],
        recentPosts: recentPosts ?? [],
        recentComments: recentCommentsR.data ?? [],
        recentReports: recentReportsR.data ?? [],
        payments: paymentsR.data ?? [],
        dailyStats: dailyR.data ?? [],
        cron: { total: cronData.length, success: cronSuccess, fail: cronFail, failNames: cronFailNames, anthropicCreditWarning },
        stockKpi,
        stockHealth,
        complexKpi,
        premiumKpi,
        seo: {
          siteTypeBreakdown,
          totalSites: scoreStats?.length || 0,
          totalSitemap,
          sitemapPct: scoreStats?.length ? Math.round((totalSitemap / scoreStats.length) * 100) : 0,
          blogRewrittenPct,
          indexedBlogs: premiumKpi.indexNow.done,
          unindexedBlogs: premiumKpi.indexNow.pending,
        },
        blogProduction: {
          today: blogTodayR.count ?? 0,
          queue: blogQueueR.count ?? 0,
          readyToPublish: (blogUnpubR.data || []).filter((b: any) => (b.content?.length ?? 0) >= 1200).length,
          categoryBreakdown: blogCatMap,
        },
        commentStats: {
          today: commentsTodayR.count ?? 0,
          totalReplies: repliesR.count ?? 0,
        },
        cronByCategory,
        dataCoverage,
      });
    }

    if (section === 'users') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = 50;
      const search = searchParams.get('search') || '';
      const filter = searchParams.get('filter') || 'all'; // all, real, seed, banned, premium

      let query = sb.from('profiles')
        .select('id, nickname, full_name, grade, grade_title, provider, created_at, last_active_at, posts_count, likes_count, points, is_admin, is_banned, is_deleted, is_seed, is_premium, premium_expires_at, region_text, residence_city, bio, interests, influence_score, streak_days, followers_count, following_count, kakao_id, google_email, phone, age_group, gender, onboarded, profile_completed, marketing_agreed, consent_analytics, nickname_change_count', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (search) { const sq = sanitizeSearchQuery(search, 50); if (sq) query = query.or(`nickname.ilike.%${sq}%,full_name.ilike.%${sq}%`); }
      if (filter === 'real') query = query.or('is_seed.is.null,is_seed.eq.false');
      if (filter === 'seed') query = query.eq('is_seed', true);
      if (filter === 'banned') query = query.eq('is_banned', true);
      if (filter === 'premium') query = query.eq('is_premium', true);
      if (filter === 'admin') query = query.eq('is_admin', true);

      const { data, count } = await query.range((page - 1) * limit, page * limit - 1);

      return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit });
    }

    if (section === 'user-detail') {
      const userId = searchParams.get('id');
      if (!userId) return NextResponse.json({ error: 'id required' }, { status: 400 });

      const [profileR, notiR, pushR, pwaR, attendR, watchlistR, bookmarkR, alertsR] = await Promise.all([
        sb.from('profiles')
          .select('id, nickname, full_name, grade, grade_title, provider, created_at, last_active_at, posts_count, likes_count, points, is_admin, is_banned, is_deleted, is_seed, is_premium, premium_expires_at, region_text, residence_city, bio, interests, influence_score, streak_days, followers_count, following_count, kakao_id, google_email, phone, age_group, gender, onboarded, profile_completed, marketing_agreed, consent_analytics, nickname_change_count')
          .eq('id', userId).single(),
        sb.from('notification_settings')
          .select('push_comments, push_likes, push_follows, push_hot_post, push_news, push_stock_alert, push_apt_deadline, push_daily_digest, push_attendance, quiet_start, quiet_end')
          .eq('user_id', userId).maybeSingle(),
        sb.from('push_subscriptions')
          .select('id, created_at, endpoint')
          .eq('user_id', userId),
        sb.from('pwa_installs')
          .select('platform, installed_at, user_agent')
          .eq('user_id', userId),
        sb.from('attendance')
          .select('total_days, streak, last_date')
          .eq('user_id', userId).maybeSingle(),
        sb.from('stock_watchlist')
          .select('symbol', { count: 'exact', head: true })
          .eq('user_id', userId),
        sb.from('apt_bookmarks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        sb.from('price_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

      if (!profileR.data) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      return NextResponse.json({
        profile: profileR.data,
        notifications: notiR.data ?? null,
        pushSubscriptions: (pushR.data ?? []).length,
        pushDevices: (pushR.data ?? []).map((p: Record<string, any>) => ({
          id: p.id,
          created_at: p.created_at,
          browser: p.endpoint?.includes('fcm') ? 'Chrome/Android' : p.endpoint?.includes('mozilla') ? 'Firefox' : p.endpoint?.includes('apple') ? 'Safari/iOS' : 'Unknown',
        })),
        pwaInstalls: (pwaR.data ?? []).map((p: Record<string, any>) => ({
          platform: p.platform,
          installed_at: p.installed_at,
          browser: extractBrowser(p.user_agent),
        })),
        attendance: attendR.data ?? null,
        counts: {
          watchlist: watchlistR.count ?? 0,
          bookmarks: bookmarkR.count ?? 0,
          priceAlerts: alertsR.count ?? 0,
        },
      });
    }

    if (section === 'content') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = 30;
      const tab = searchParams.get('tab') || 'posts'; // posts, comments, chat, discuss

      // 총계 항상 포함
      const [postsCountR, commentsCountR, discussCountR, messagesCountR] = await Promise.all([
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('comments').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('discussion_topics').select('id', { count: 'exact', head: true }),
        sb.from('chat_messages').select('id', { count: 'exact', head: true }),
      ]);
      const totals = { totalPosts: postsCountR.count ?? 0, totalComments: commentsCountR.count ?? 0, totalDiscussions: discussCountR.count ?? 0, totalMessages: messagesCountR.count ?? 0 };

      if (tab === 'posts') {
        const { data, count } = await sb.from('posts')
          .select('id, title, content, category, created_at, view_count, likes_count, comments_count, is_deleted, is_pinned, slug, profiles!posts_author_id_fkey(nickname)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);
        return NextResponse.json({ posts: data ?? [], total: count ?? 0, ...totals });
      }
      if (tab === 'comments') {
        const { data, count } = await sb.from('comments')
          .select('id, content, created_at, is_deleted, post_id, profiles!comments_author_id_fkey(nickname)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);
        return NextResponse.json({ comments: data ?? [], total: count ?? 0, ...totals });
      }
      if (tab === 'discuss') {
        const { data } = await sb.from('discussion_topics')
          .select('id, title, category, option_a, option_b, vote_a, vote_b, comment_count, view_count, is_hot, created_at')
          .order('created_at', { ascending: false }).limit(100);
        return NextResponse.json({ discussions: data ?? [], ...totals });
      }
      if (tab === 'chat') {
        const { data } = await sb.from('chat_messages')
          .select('id, content, created_at, profiles!chat_messages_user_id_fkey(nickname)')
          .order('created_at', { ascending: false }).limit(100);
        return NextResponse.json({ messages: data ?? [], ...totals });
      }
    }

    if (section === 'blog') {
      const { data: stats } = await sb.from('blog_posts')
        .select('id, category, is_published, rewritten_at, view_count, created_at')
        .eq('is_published', true);

      const posts = stats ?? [];
      const total = posts.length;
      const rewritten = posts.filter(p => p.rewritten_at).length;
      const byCat: Record<string, number> = {};
      for (const p of posts) byCat[p.category] = (byCat[p.category] || 0) + 1;
      const totalViews = posts.reduce((s, p) => s + (p.view_count || 0), 0);

      // 최근 블로그 20건
      const { data: recent } = await sb.from('blog_posts')
        .select('id, slug, title, category, view_count, comment_count, helpful_count, is_published, rewritten_at, created_at')
        .order('created_at', { ascending: false }).limit(20);

      // 인기글 TOP 10
      const { data: topPosts } = await sb.from('blog_posts')
        .select('title, slug, view_count, comment_count, helpful_count, category')
        .eq('is_published', true)
        .order('view_count', { ascending: false })
        .limit(10);

      // 댓글 많은 글 TOP 5
      const { data: topCommented } = await sb.from('blog_posts')
        .select('title, slug, comment_count, category')
        .eq('is_published', true).gt('comment_count', 0)
        .order('comment_count', { ascending: false })
        .limit(5);

      // helpful 많은 글 TOP 5
      const { data: topHelpful } = await sb.from('blog_posts')
        .select('title, slug, helpful_count, category')
        .eq('is_published', true).gt('helpful_count', 0)
        .order('helpful_count', { ascending: false })
        .limit(5);

      // 카테고리별 조회수
      let catViews: any[] = [];
      try {
        const { data: cv } = await sb.rpc('blog_category_views');
        catViews = cv || [];
      } catch {}

      // 최근 7일 발행 건수
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: recentPublished } = await sb.from('blog_posts')
        .select('created_at')
        .eq('is_published', true)
        .gte('created_at', sevenDaysAgo);
      const dailyCounts: Record<string, number> = {};
      (recentPublished || []).forEach(p => {
        const day = new Date(p.created_at!).toISOString().slice(0, 10);
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });

      // 평균 읽기시간
      const avgReadTime = posts.length > 0
        ? Math.round(posts.reduce((s, p: any) => s + (p.reading_time_min || 3), 0) / posts.length)
        : 0;

      return NextResponse.json({
        blog: { total, rewritten, unrewritten: total - rewritten, byCat, totalViews, avgReadTime },
        recentBlogs: recent ?? [],
        insights: {
          topPosts: topPosts ?? [],
          topCommented: topCommented ?? [],
          topHelpful: topHelpful ?? [],
          catViews,
          dailyCounts,
        },
      });
    }

    if (section === 'realestate') {
      const [sitesR, subsR, unsoldR, redevR, interestsR] = await Promise.all([
        sb.from('apt_sites').select('id, slug, name, site_type, region, sigungu, content_score, interest_count, status, created_at, updated_at')
          .eq('is_active', true).order('interest_count', { ascending: false }).limit(100),
        sb.from('apt_subscriptions').select('id, house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co')
          .order('rcept_bgnde', { ascending: false }).limit(50),
        sb.from('unsold_apts').select('id, house_nm, region_nm, tot_unsold_hshld_co, tot_supply_hshld_co')
          .order('unsold_count', { ascending: false }).limit(50),
        sb.from('redevelopment_projects').select('id, district_name, region, stage, total_households')
          .eq('is_active', true).limit(50),
        sb.from('apt_site_interests').select('id, site_id, name, phone_encrypted, created_at, is_member')
          .order('created_at', { ascending: false }).limit(50),
      ]);

      return NextResponse.json({
        sites: sitesR.data ?? [],
        subscriptions: subsR.data ?? [],
        unsold: unsoldR.data ?? [],
        redevelopment: redevR.data ?? [],
        interests: interestsR.data ?? [],
      });
    }

    if (section === 'system') {
      const hours = parseInt(searchParams.get('hours') || '24');
      const since = new Date(Date.now() - hours * 3600000).toISOString();

      const [cronR, healthR] = await Promise.all([
        sb.from('cron_logs').select('cron_name, status, duration_ms, error_message, created_at')
          .gte('created_at', since).order('created_at', { ascending: false }).limit(500),
        sb.from('health_checks').select('*').order('checked_at', { ascending: false }).limit(1),
      ]);

      // 크론별 집계
      const cronMap = new Map<string, any>();
      for (const row of cronR.data || []) {
        if (!cronMap.has(row.cron_name)) {
          cronMap.set(row.cron_name, {
            name: row.cron_name, runs: 0, success: 0, failed: 0,
            durations: [], lastRun: row.created_at, lastStatus: row.status, lastError: null,
          });
        }
        const m = cronMap.get(row.cron_name)!;
        m.runs++;
        if (row.status === 'success') m.success++;
        else { m.failed++; if (!m.lastError) m.lastError = row.error_message; }
        if (row.duration_ms) m.durations.push(row.duration_ms);
      }

      const cronSummary = [...cronMap.values()].map(m => ({
        ...m,
        avgDuration: m.durations.length ? Math.round(m.durations.reduce((a: number, b: number) => a + b, 0) / m.durations.length) : 0,
        durations: undefined,
      })).sort((a, b) => b.failed - a.failed || new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime());

      return NextResponse.json({
        crons: cronSummary,
        health: healthR.data?.[0] ?? null,
        totalRuns: cronR.data?.length ?? 0,
      });
    }

    if (section === 'reports') {
      const { data } = await sb.from('reports')
        .select('id, reason, details, content_type, status, auto_hidden, created_at, post_id, comment_id, profiles!reports_reporter_id_fkey(nickname)')
        .order('created_at', { ascending: false }).limit(100);
      return NextResponse.json({ reports: data ?? [] });
    }

    if (section === 'payments') {
      const { data } = await sb.from('payments')
        .select('id, user_id, amount, status, product_id, created_at, payment_key, order_id')
        .order('created_at', { ascending: false }).limit(100);
      return NextResponse.json({ payments: data ?? [] });
    }

    if (section === 'insights') {
      const now24h = new Date(Date.now() - 24 * 3600000).toISOString();
      const now7d = new Date(Date.now() - 7 * 86400000).toISOString();

      const [searchR, noResultR, shareR, shareTopR, feedbackR, inviteR] = await Promise.all([
        // 인기 검색어 24h (직접 쿼리)
        sb.from('search_logs').select('query').gte('created_at', now24h).limit(500),
        // 결과 없음 검색어 7d
        sb.from('search_logs').select('query').eq('results_count', 0).gte('created_at', now7d).limit(200),
        // 공유 플랫폼별 7d
        sb.from('share_logs').select('platform').gte('created_at', now7d).limit(500),
        // 가장 많이 공유된 글
        sb.from('share_logs').select('post_id').gte('created_at', now7d).limit(500),
        // 피드백 최근
        sb.from('user_feedback').select('id, user_id, message, category, rating, created_at').order('created_at', { ascending: false }).limit(20),
        // 초대 현황
        sb.from('invite_codes').select('id, creator_id, is_used, used_at, created_at').limit(500),
      ]);

      // 검색어 집계
      const sMap = new Map<string, number>();
      for (const r of searchR.data || []) { sMap.set(r.query, (sMap.get(r.query) || 0) + 1); }
      const topSearches = [...sMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count }));

      // 결과 없음 검색어 집계
      const noMap = new Map<string, number>();
      for (const r of noResultR.data || []) { noMap.set(r.query, (noMap.get(r.query) || 0) + 1); }
      const noResults = [...noMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count }));

      // 공유 플랫폼별
      const platformMap = new Map<string, number>();
      for (const r of shareR.data || []) { platformMap.set(r.platform, (platformMap.get(r.platform) || 0) + 1); }
      const sharePlatforms = [...platformMap.entries()].sort((a, b) => b[1] - a[1]).map(([platform, count]) => ({ platform, count }));

      // 가장 많이 공유된 글
      const postShareMap = new Map<number, number>();
      for (const r of shareTopR.data || []) { postShareMap.set(r.post_id, (postShareMap.get(r.post_id) || 0) + 1); }
      const topShared = [...postShareMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([post_id, count]) => ({ post_id, count }));

      // 초대 현황
      const invites = inviteR.data || [];
      const inviteUsed = invites.filter((i: any) => i.is_used).length;
      const inviterMap = new Map<string, number>();
      for (const i of invites.filter((x: any) => x.is_used)) { inviterMap.set(i.creator_id, (inviterMap.get(i.creator_id) || 0) + 1); }
      const topInviters = [...inviterMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([creator_id, count]) => ({ creator_id, count }));

      return NextResponse.json({
        topSearches,
        noResults,
        sharePlatforms,
        topShared,
        feedback: feedbackR.data || [],
        inviteStats: { total: invites.length, used: inviteUsed, topInviters },
      });
    }

    return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

function extractBrowser(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Samsung')) return 'Samsung Browser';
  if (ua.includes('CriOS')) return 'Chrome iOS';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edge')) return 'Edge';
  return 'Other';
}
