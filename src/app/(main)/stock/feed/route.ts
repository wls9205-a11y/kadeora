import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 1800;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data: stocks } = await sb.from('stock_quotes')
    .select('symbol, name, market, price, change_pct, currency, sector, updated_at')
    .gt('price', 0)
    .order('updated_at', { ascending: false })
    .limit(200);

  const items = (stocks || []).map(s => {
    const pct = Number(s.change_pct) || 0;
    const arrow = pct >= 0 ? '▲' : '▼';
    const priceStr = s.currency === 'USD' ? `$${Number(s.price).toFixed(2)}` : `₩${Number(s.price).toLocaleString()}`;
    return `
    <item>
      <title><![CDATA[${s.name} (${s.symbol}) ${priceStr} ${arrow}${Math.abs(pct).toFixed(2)}%]]></title>
      <link>${SITE_URL}/stock/${encodeURIComponent(s.symbol)}</link>
      <description><![CDATA[${s.name} ${s.market} 상장. 현재가 ${priceStr}, 전일대비 ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%. 섹터: ${s.sector || '-'}]]></description>
      <pubDate>${new Date(s.updated_at || Date.now()).toUTCString()}</pubDate>
      <category>${s.sector || s.market}</category>
      <guid isPermaLink="true">${SITE_URL}/stock/${encodeURIComponent(s.symbol)}</guid>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>카더라 주식 RSS</title>
    <link>${SITE_URL}/stock</link>
    <description>최근 업데이트된 종목 200개 실시간 시세 — 국내외 1,700+ 종목</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/stock/feed" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
