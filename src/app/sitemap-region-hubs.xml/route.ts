import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;
export const maxDuration = 30;

const CATEGORIES = ['subscription', 'trade', 'redevelopment', 'unsold', 'landmark'];

function escapeXml(s: string) {
  return s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c] || c));
}

export async function GET() {
  let sigunguCombos: Array<{ region: string; sigungu: string; site_type: string }> = [];
  let regionsForRanking: Array<{ region: string; site_type: string }> = [];
  try {
    const sb = getSupabaseAdmin();
    const [hubRes, rankRes] = await Promise.all([
      (sb as any).from('v_region_hub_clusters').select('region,sigungu,site_type').limit(2000),
      (sb as any).from('v_apt_ranking_by_region').select('region,site_type').lte('rank', 1).limit(500),
    ]);
    sigunguCombos = ((hubRes as any)?.data ?? []) as any;
    regionsForRanking = ((rankRes as any)?.data ?? []) as any;
  } catch (err) {
    console.error('[sitemap-region-hubs] fetch error', err);
  }

  const now = new Date().toISOString();
  const urls: string[] = [];

  for (const c of sigunguCombos) {
    if (!c.region || !c.sigungu || !c.site_type) continue;
    if (!CATEGORIES.includes(c.site_type)) continue;
    const loc = `${SITE_URL}/apt/region/${encodeURIComponent(c.region)}/${encodeURIComponent(c.sigungu)}/${encodeURIComponent(c.site_type)}`;
    urls.push(`<url><loc>${escapeXml(loc)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }

  const rankingSet = new Set<string>();
  for (const r of regionsForRanking) {
    if (!r.region || !r.site_type) continue;
    if (!CATEGORIES.includes(r.site_type)) continue;
    const k = `${r.region}:${r.site_type}`;
    if (rankingSet.has(k)) continue;
    rankingSet.add(k);
    const loc = `${SITE_URL}/apt/ranking/${encodeURIComponent(r.region)}/${encodeURIComponent(r.site_type)}`;
    urls.push(`<url><loc>${escapeXml(loc)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
