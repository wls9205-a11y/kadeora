import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Admin check
  try {
    const authSb = await createSupabaseServer();
    const { data: { user } } = await authSb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await authSb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '7d'; // 1d, 7d, 30d

  const days = range === '1d' ? 1 : range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Admin user IDs to exclude
  const { data: admins } = await sb.from('profiles').select('id').eq('is_admin', true);
  const adminIds = (admins || []).map((a: { id: string }) => a.id);

  try {
    // All page_views in range (exclude admin by user_id — note: most views don't have user_id)
    const { data: views } = await sb
      .from('page_views')
      .select('id, visitor_id, user_id, path, referrer, user_agent, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000);

    const filtered = (views || []).filter((v) => {
      if (!v.user_id) return true;
      return !adminIds.includes(v.user_id);
    });

    // === KPIs ===
    const totalViews = filtered.length;
    const uniqueVisitors = new Set(filtered.map((v: { visitor_id?: string }) => v.visitor_id)).size;
    const withUser = filtered.filter((v: Record<string, any>) => v.user_id).length;
    const avgViewsPerVisitor = uniqueVisitors > 0 ? (totalViews / uniqueVisitors).toFixed(1) : '0';

    // === Top Pages ===
    const pageCounts: Record<string, number> = {};
    filtered.forEach((v: Record<string, any>) => {
      // Normalize: decode + group dynamic paths
      let p = v.path;
      try { p = decodeURIComponent(p); } catch {}
      if (p.startsWith('/feed/') && p.length > 10) p = '/feed/[slug]';
      if (p.startsWith('/blog/') && p.length > 10) p = '/blog/[slug]';
      if (p.startsWith('/stock/') && p.length > 10) p = '/stock/[symbol]';
      if (p.startsWith('/apt/') && p.length > 8) p = '/apt/[id]';
      if (p.startsWith('/discuss/') && p.length > 12) p = '/discuss/[id]';
      if (p.startsWith('/profile/') && p.length > 12) p = '/profile/[id]';
      pageCounts[p] = (pageCounts[p] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([path, count]) => ({ path, count, pct: ((count / totalViews) * 100).toFixed(1) }));

    // === Referrers ===
    const refCounts: Record<string, number> = {};
    filtered.forEach((v: Record<string, any>) => {
      if (!v.referrer) {
        refCounts['직접 방문'] = (refCounts['직접 방문'] || 0) + 1;
        return;
      }
      let ref = v.referrer;
      try {
        const u = new URL(ref);
        if (u.hostname.includes('kadeora')) { refCounts['내부 이동'] = (refCounts['내부 이동'] || 0) + 1; return; }
        if (u.hostname.includes('google')) ref = 'Google';
        else if (u.hostname.includes('naver')) ref = 'Naver';
        else if (u.hostname.includes('daum') || u.hostname.includes('kakao')) ref = 'Kakao/Daum';
        else if (u.hostname.includes('facebook') || u.hostname.includes('fb.')) ref = 'Facebook';
        else if (u.hostname.includes('instagram')) ref = 'Instagram';
        else if (u.hostname.includes('twitter') || u.hostname.includes('t.co')) ref = 'X (Twitter)';
        else ref = u.hostname.replace('www.', '');
      } catch { ref = ref.slice(0, 30); }
      refCounts[ref] = (refCounts[ref] || 0) + 1;
    });
    const referrers = Object.entries(refCounts)
      .filter(([k]) => k !== '내부 이동')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, count]) => ({ source, count, pct: ((count / totalViews) * 100).toFixed(1) }));

    // === Hourly distribution ===
    const hourCounts: Record<number, number> = {};
    filtered.forEach((v: Record<string, any>) => {
      const h = new Date(v.created_at).getUTCHours();
      const kstH = (h + 9) % 24;
      hourCounts[kstH] = (hourCounts[kstH] || 0) + 1;
    });
    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourCounts[i] || 0 }));

    // === Daily trend ===
    const dayCounts: Record<string, { views: number; visitors: Set<string> }> = {};
    filtered.forEach((v: Record<string, any>) => {
      const d = new Date(v.created_at).toISOString().split('T')[0];
      if (!dayCounts[d]) dayCounts[d] = { views: 0, visitors: new Set() };
      dayCounts[d].views++;
      dayCounts[d].visitors.add(v.visitor_id);
    });
    const daily = Object.entries(dayCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date: date.slice(5), views: d.views, visitors: d.visitors.size }));

    // === Device breakdown (from user_agent) ===
    let mobile = 0, desktop = 0, bot = 0;
    filtered.forEach((v: Record<string, any>) => {
      const ua = (v.user_agent || '').toLowerCase();
      if (/bot|crawl|spider|slurp|bingpreview|facebookexternal|twitterbot|kakaotalk-scrap/i.test(ua)) bot++;
      else if (/mobile|android|iphone|ipad/i.test(ua)) mobile++;
      else desktop++;
    });
    const devices = { mobile, desktop, bot };

    // === Top raw pages (not grouped) — recent 20 ===
    const recentViews = filtered.slice(0, 20).map((v: Record<string, any>) => {
      let path = v.path;
      try { path = decodeURIComponent(path); } catch {}
      return {
        path: path.length > 50 ? path.slice(0, 47) + '...' : path,
        referrer: v.referrer ? (() => {
          try { return new URL(v.referrer).hostname.replace('www.', ''); } catch { return v.referrer.slice(0, 20); }
        })() : '직접',
        time: v.created_at,
        device: /mobile|android|iphone/i.test(v.user_agent || '') ? 'M' : 'D',
      };
    });

    return NextResponse.json({
      range,
      kpi: { totalViews, uniqueVisitors, withUser, avgViewsPerVisitor },
      topPages,
      referrers,
      hourly,
      daily,
      devices,
      recentViews,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
