import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import { generateAptSlug } from '@/lib/apt-slug';

export const revalidate = 3600;

export async function GET() {
  const sb = getSupabaseAdmin();

  const [subsRes, unsoldRes] = await Promise.all([
    sb.from('apt_subscriptions')
      .select('id, house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co, hssply_adres, fetched_at')
      .order('rcept_endde', { ascending: false })
      .limit(60),
    sb.from('unsold_apts')
      .select('id, house_nm, region_nm, tot_unsold_hshld_co, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const subItems = (subsRes.data || []).map(s => {
    const slug = generateAptSlug(s.house_nm) || String(s.id);
    return `
    <item>
      <title><![CDATA[${s.house_nm} — ${s.region_nm} 청약]]></title>
      <link>${SITE_URL}/apt/${encodeURIComponent(slug)}</link>
      <description><![CDATA[${s.hssply_adres || s.region_nm}. ${s.tot_supply_hshld_co || ''}세대 공급. 접수기간 ${s.rcept_bgnde || ''} ~ ${s.rcept_endde || ''}]]></description>
      <pubDate>${new Date(s.fetched_at || s.rcept_bgnde || Date.now()).toUTCString()}</pubDate>
      <category>청약</category>
      <guid isPermaLink="true">${SITE_URL}/apt/${encodeURIComponent(slug)}</guid>
    </item>`;
  });

  const unsoldItems = (unsoldRes.data || []).map(u => {
    const slug = generateAptSlug(u.house_nm) || `unsold-${u.id}`;
    return `
    <item>
      <title><![CDATA[${u.house_nm} — ${u.region_nm} 미분양 ${u.tot_unsold_hshld_co}세대]]></title>
      <link>${SITE_URL}/apt/${encodeURIComponent(slug)}</link>
      <description><![CDATA[${u.region_nm} ${u.house_nm} 미분양 ${u.tot_unsold_hshld_co}세대]]></description>
      <pubDate>${new Date(u.created_at || Date.now()).toUTCString()}</pubDate>
      <category>미분양</category>
      <guid isPermaLink="true">${SITE_URL}/apt/${encodeURIComponent(slug)}</guid>
    </item>`;
  });

  const items = [...subItems, ...unsoldItems].join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>카더라 부동산 RSS</title>
    <link>${SITE_URL}/apt</link>
    <description>최근 청약·분양·미분양 뉴스</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/apt/feed" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
