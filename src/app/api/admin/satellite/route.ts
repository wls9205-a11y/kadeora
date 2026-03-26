import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 30;

const SITES = [
  { domain: 'xn--zf0bv61a84di4cc7c4tay28c.com', name: '분양권실전투자', color: '#1E40AF', label: '분' },
  { domain: 'xn--kj0bw8tr3a.com', name: '급매물', color: '#DC2626', label: '급' },
  { domain: 'xn--9i2by8fvyb69i.site', name: '주린이', color: '#059669', label: '주' },
];

const FETCH_OPTS = {
  headers: { 'User-Agent': 'KadeoraBot/1.0 (+https://kadeora.app)' },
  redirect: 'follow' as const,
};

async function checkSite(site: typeof SITES[0]) {
  const checks = await Promise.allSettled([
    fetch(`https://${site.domain}/`, { ...FETCH_OPTS, signal: AbortSignal.timeout(10000) }),
    fetch(`https://${site.domain}/favicon.ico`, { ...FETCH_OPTS, signal: AbortSignal.timeout(8000) }),
    fetch(`https://${site.domain}/sitemap_index.xml`, { ...FETCH_OPTS, signal: AbortSignal.timeout(8000) }),
    fetch(`https://${site.domain}/robots.txt`, { ...FETCH_OPTS, signal: AbortSignal.timeout(8000) }),
    fetch(`https://${site.domain}/llms.txt`, { ...FETCH_OPTS, signal: AbortSignal.timeout(8000) }),
    fetch(`https://${site.domain}/feed/`, { ...FETCH_OPTS, signal: AbortSignal.timeout(10000) }),
  ]);

  const [homepage, favicon, sitemap, robots, llms, rss] = checks;

  let status: 'ok' | 'error' | 'expired' = 'error';
  if (homepage.status === 'fulfilled' && homepage.value.ok) {
    const html = await homepage.value.text();
    status = (html.includes('domain is expired') || html.includes('domain has expired') || html.includes('renovar el dominio')) ? 'expired' : 'ok';
  }

  let rssItems = 0;
  if (rss.status === 'fulfilled' && rss.value.ok) {
    const text = await rss.value.text();
    rssItems = (text.match(/<item>/g) || []).length;
  }

  let robotsAI = false;
  if (robots.status === 'fulfilled' && robots.value.ok) {
    const text = await robots.value.text();
    robotsAI = text.includes('GPTBot');
  }

  return {
    domain: site.domain,
    name: site.name,
    color: site.color,
    label: site.label,
    status,
    rssItems,
    favicon: favicon.status === 'fulfilled' && favicon.value.ok,
    sitemap: sitemap.status === 'fulfilled' && sitemap.value.ok,
    robotsAI,
    llmsTxt: llms.status === 'fulfilled' && llms.value.ok,
    httpCode: homepage.status === 'fulfilled' ? homepage.value.status : 0,
    error: homepage.status === 'rejected' ? String(homepage.reason).slice(0, 100) : null,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const results = await Promise.allSettled(SITES.map(checkSite));
  const sites = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof checkSite>>> => r.status === 'fulfilled')
    .map(r => r.value);

  return NextResponse.json({ sites, lastCheck: new Date().toISOString() });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { action } = await req.json();

  switch (action) {
    case 'check_status':
      return NextResponse.json({ message: '상태 체크 완료 — 페이지를 새로고침하세요' });

    case 'ping_search': {
      const pings = await Promise.allSettled(
        SITES.map(s =>
          fetch(`https://api.indexnow.org/indexnow?url=https://${s.domain}/&key=indexnow`, { signal: AbortSignal.timeout(5000) })
        )
      );
      const ok = pings.filter(r => r.status === 'fulfilled').length;
      return NextResponse.json({ message: `IndexNow Ping: ${ok}/${SITES.length} 성공` });
    }

    default:
      return NextResponse.json({ message: '알 수 없는 액션' }, { status: 400 });
  }
}
