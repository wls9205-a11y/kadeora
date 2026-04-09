export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

/**
 * aggregate-user-events 크론 — 일별 유저 행동 집계
 * 
 * user_events → user_daily_summary 집계
 * 주기: 매일 02:00
 */
async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
  const dayStart = `${yesterday}T00:00:00+09:00`;
  const dayEnd = `${yesterday}T23:59:59+09:00`;

  // 어제의 이벤트 집계
  const { data: events } = await (sb as any).from('user_events')
    .select('visitor_id, user_id, session_id, event_type, event_name, page_path, page_category, duration_ms, device_type, properties')
    .gte('created_at', dayStart)
    .lt('created_at', dayEnd)
    .limit(50000);

  if (!events || events.length === 0) {
    return NextResponse.json({ date: yesterday, visitors: 0, skipped: true });
  }

  // visitor_id별 집계
  const visitors = new Map<string, {
    user_id: string | null;
    sessions: Set<string>;
    pages: Set<string>;
    pvTotal: number;
    pvBlog: number; pvApt: number; pvStock: number; pvFeed: number; pvCalc: number;
    totalDuration: number;
    scrollDepths: number[];
    searches: number; clicks: number; shares: number;
    ctaViews: number; ctaClicks: number;
    device: string;
  }>();

  for (const e of events) {
    const vid = e.visitor_id;
    if (!visitors.has(vid)) {
      visitors.set(vid, {
        user_id: e.user_id, sessions: new Set(), pages: new Set(),
        pvTotal: 0, pvBlog: 0, pvApt: 0, pvStock: 0, pvFeed: 0, pvCalc: 0,
        totalDuration: 0, scrollDepths: [],
        searches: 0, clicks: 0, shares: 0, ctaViews: 0, ctaClicks: 0,
        device: e.device_type || 'unknown',
      });
    }
    const v = visitors.get(vid)!;
    if (e.user_id) v.user_id = e.user_id;
    if (e.session_id) v.sessions.add(e.session_id);
    if (e.device_type) v.device = e.device_type;

    if (e.event_type === 'page_view' && e.event_name === 'enter') {
      v.pvTotal++;
      if (e.page_path) v.pages.add(e.page_path);
      if (e.page_category === 'blog') v.pvBlog++;
      if (e.page_category === 'apt') v.pvApt++;
      if (e.page_category === 'stock') v.pvStock++;
      if (e.page_category === 'feed') v.pvFeed++;
      if (e.page_category === 'calc') v.pvCalc++;
    }
    if (e.event_type === 'page_view' && e.event_name === 'leave' && e.duration_ms) {
      v.totalDuration += Math.min(e.duration_ms, 600000); // cap 10분
    }
    if (e.event_type === 'scroll') {
      const depth = e.properties?.depth;
      if (typeof depth === 'number') v.scrollDepths.push(depth);
    }
    if (e.event_type === 'search') v.searches++;
    if (e.event_type === 'click') v.clicks++;
    if (e.event_type === 'share') v.shares++;
    if (e.event_type === 'cta' && e.event_name?.startsWith('view_')) v.ctaViews++;
    if (e.event_type === 'cta' && e.event_name?.startsWith('click_')) v.ctaClicks++;
  }

  // engagement_score 계산 (0~100)
  function calcEngagement(v: typeof visitors extends Map<string, infer V> ? V : never): number {
    let score = 0;
    score += Math.min(v.pvTotal * 5, 20);           // PV: 최대 20
    score += Math.min(v.pages.size * 4, 16);         // 고유 페이지: 최대 16
    score += Math.min(v.sessions.size * 5, 10);      // 세션: 최대 10
    score += Math.min(v.totalDuration / 60000 * 5, 20); // 체류(분): 최대 20
    const avgScroll = v.scrollDepths.length > 0 ? v.scrollDepths.reduce((a, b) => a + b, 0) / v.scrollDepths.length : 0;
    score += Math.min(avgScroll / 100 * 10, 10);     // 스크롤: 최대 10
    score += Math.min(v.searches * 3, 6);            // 검색: 최대 6
    score += Math.min(v.clicks * 2, 8);              // 클릭: 최대 8
    score += Math.min(v.shares * 5, 5);              // 공유: 최대 5
    score += Math.min(v.ctaClicks * 5, 5);           // CTA: 최대 5
    return Math.min(Math.round(score), 100);
  }

  const rows = [...visitors.entries()].map(([vid, v]) => ({
    stat_date: yesterday,
    visitor_id: vid,
    user_id: v.user_id,
    page_views: v.pvTotal,
    unique_pages: v.pages.size,
    sessions: v.sessions.size,
    total_duration_sec: Math.round(v.totalDuration / 1000),
    avg_scroll_depth: v.scrollDepths.length > 0 ? Math.round(v.scrollDepths.reduce((a, b) => a + b, 0) / v.scrollDepths.length) : 0,
    pv_blog: v.pvBlog, pv_apt: v.pvApt, pv_stock: v.pvStock, pv_feed: v.pvFeed, pv_calc: v.pvCalc,
    searches: v.searches, clicks: v.clicks, shares: v.shares,
    cta_views: v.ctaViews, cta_clicks: v.ctaClicks,
    engagement_score: calcEngagement(v),
    primary_device: v.device,
  }));

  // upsert (중복 실행 방지)
  const { error } = await (sb as any).from('user_daily_summary')
    .upsert(rows, { onConflict: 'stat_date,visitor_id', ignoreDuplicates: false });

  // 오래된 raw 이벤트 정리 (14일 이상)
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  await (sb as any).from('user_events').delete().lt('created_at', cutoff);

  return NextResponse.json({
    date: yesterday,
    visitors: visitors.size,
    events: events.length,
    summaries: rows.length,
    error: error?.message || null,
  });
}

export const GET = withCronAuth(handler);
