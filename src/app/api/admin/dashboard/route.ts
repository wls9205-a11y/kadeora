import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

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
        sb.from('stock_quotes').select('id', { count: 'exact', head: true }),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_site_interests').select('id', { count: 'exact', head: true }),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
        sb.from('payments').select('id, amount_krw, status, created_at').order('created_at', { ascending: false }).limit(10),
        sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('daily_stats').select('*').order('date', { ascending: false }).limit(14),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        sb.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active_at', weekAgo),
        sb.from('discussion_topics').select('id', { count: 'exact', head: true }),
        sb.from('cron_logs').select('cron_name, status, duration_ms, created_at')
          .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .order('created_at', { ascending: false }).limit(200),
      ]);

      // 최근 가입 유저 5명
      const { data: recentUsers } = await sb.from('profiles')
        .select('id, nickname, provider, created_at, grade, is_seed, region_text')
        .order('created_at', { ascending: false }).limit(5);

      // 크론 요약
      const cronData = cronR.data || [];
      const cronSuccess = cronData.filter(c => c.status === 'success').length;
      const cronFail = cronData.filter(c => c.status === 'failed').length;

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
        recentUsers: recentUsers ?? [],
        payments: paymentsR.data ?? [],
        dailyStats: dailyR.data ?? [],
        cron: { total: cronData.length, success: cronSuccess, fail: cronFail },
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

      if (search) query = query.or(`nickname.ilike.%${search}%,full_name.ilike.%${search}%`);
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
        pushDevices: (pushR.data ?? []).map((p: any) => ({
          id: p.id,
          created_at: p.created_at,
          browser: p.endpoint?.includes('fcm') ? 'Chrome/Android' : p.endpoint?.includes('mozilla') ? 'Firefox' : p.endpoint?.includes('apple') ? 'Safari/iOS' : 'Unknown',
        })),
        pwaInstalls: (pwaR.data ?? []).map((p: any) => ({
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

      if (tab === 'posts') {
        const { data, count } = await sb.from('posts')
          .select('id, title, content, category, created_at, view_count, likes_count, comments_count, is_deleted, slug, profiles!posts_author_id_fkey(nickname)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);
        return NextResponse.json({ posts: data ?? [], total: count ?? 0 });
      }
      if (tab === 'comments') {
        const { data, count } = await sb.from('comments')
          .select('id, content, created_at, is_deleted, post_id, profiles!comments_author_id_fkey(nickname)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);
        return NextResponse.json({ comments: data ?? [], total: count ?? 0 });
      }
      if (tab === 'discuss') {
        const { data } = await sb.from('discussion_topics')
          .select('id, title, category, option_a, option_b, vote_a, vote_b, comment_count, view_count, is_hot, created_at')
          .order('created_at', { ascending: false }).limit(100);
        return NextResponse.json({ discussions: data ?? [] });
      }
      if (tab === 'chat') {
        const { data } = await sb.from('chat_messages')
          .select('id, content, created_at, profiles!chat_messages_user_id_fkey(nickname)')
          .order('created_at', { ascending: false }).limit(100);
        return NextResponse.json({ messages: data ?? [] });
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
        .select('id, slug, title, category, view_count, is_published, rewritten_at, created_at')
        .order('created_at', { ascending: false }).limit(20);

      return NextResponse.json({
        blog: { total, rewritten, unrewritten: total - rewritten, byCat, totalViews },
        recentBlogs: recent ?? [],
      });
    }

    if (section === 'realestate') {
      const [sitesR, subsR, unsoldR, redevR, interestsR] = await Promise.all([
        sb.from('apt_sites').select('id, slug, name, site_type, region, sigungu, content_score, interest_count, status, created_at, updated_at')
          .eq('is_active', true).order('interest_count', { ascending: false }).limit(100),
        sb.from('apt_subscriptions').select('id, house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co')
          .order('rcept_bgnde', { ascending: false }).limit(50),
        sb.from('unsold_apts').select('id, complex_name, region, unsold_count, total_units')
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

    return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
