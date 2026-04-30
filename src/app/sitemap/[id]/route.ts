import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';
import { fetchBatched, POSTGREST_BATCH } from '@/lib/db/fetchBatched';

export const revalidate = 3600;
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주','강남구','서초구','송파구','마포구','용산구','성남시','수원시','고양시','화성시','평택시','해운대구','부산진구','동래구'];
const SECTORS_FALLBACK = ['반도체','금융','자동차','바이오','IT','에너지','ETF','방산'];
// s214 #1+2+3: PostgREST default db-max-rows=1000 우회 — fetchBatched 헬퍼로 batch 반복 fetch.
// s216: 헬퍼 src/lib/db/fetchBatched.ts 로 추출.
// BLOG_PER_SITEMAP/COMPLEX_PER_SITEMAP 는 sitemap 1개 의 URL 수. sitemap.org 한도 50,000 이하.
const BLOG_PER_SITEMAP = 5000;

interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: number;
}

function toXml(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastModified}</lastmod>
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}

function xmlResponse(entries: SitemapEntry[]) {
  return new NextResponse(toXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await props.params;
  const id = Number(rawId.replace('.xml', ''));
  const now = new Date().toISOString();
  const buildDate = '2026-04-08T00:00:00Z'; // Static pages: fixed lastmod

  // ── 0: static + region + sector ──
  if (id === 0) {
    const sb = getSupabaseAdmin();
    // 섹터 목록: DB에서 동적 조회 (새 종목/섹터 추가 시 자동 반영)
    let SECTORS = SECTORS_FALLBACK;
    try {
      const { data: sectorData } = await sb.from('stock_quotes')
        .select('sector')
        .not('sector', 'is', null)
        .neq('sector', '')
        .gt('price', 0);
      if (sectorData?.length) {
        SECTORS = [...new Set(sectorData.map((s: any) => s.sector as string))];
      }
    } catch {}

    const staticPaths = [
      '', '/feed', '/hot', '/stock', '/apt', '/discuss', '/blog', '/about',
      '/guide', '/search', '/faq', '/terms', '/privacy', '/refund', '/shop',
      '/grades', '/apt/map', '/apt/diagnose', '/apt/complex', '/apt/redev', '/stock/compare', '/blog/series',
      '/apt/data', '/stock/data', '/stock/search', '/stock/dividend', '/stock/movers', '/stock/themes',
      '/stock/market/kospi', '/stock/market/kosdaq', '/stock/market/nyse', '/stock/market/nasdaq',
      '/stock/short-selling', '/stock/signals',
      '/calc', '/press', '/glossary', '/premium',
      // 지역별 재개발 SEO 페이지
      ...['서울','경기','부산','인천','대구','광주','대전','울산','경남','경북','충남','충북','전남','전북','강원','제주','세종'].map(r => `/apt/redev/${encodeURIComponent(r)}`),
    ];
    // 테마 페이지 (투자자 검색 키워드)
    const THEME_SLUGS = ['low-jeonse-ratio', 'high-jeonse-ratio', 'price-up', 'price-down', 'new-built', 'high-trade'];
    const THEME_REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];
    // 계산기 동적 URL
    let calcPaths: string[] = [];
    try {
      const { CALC_REGISTRY, CATEGORIES } = await import('@/lib/calc/registry');
      calcPaths = [
        ...CATEGORIES.map(c => `/calc/${c.id}`),
        ...CALC_REGISTRY.map(c => `/calc/${c.category}/${c.slug}`),
      ];
    } catch {}
    const entries: SitemapEntry[] = [
      ...staticPaths.map(path => ({
        url: `${BASE}${path}`,
        lastModified: buildDate,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : ['/feed', '/stock', '/apt'].includes(path) ? 0.9 : 0.7,
      })),
      ...calcPaths.map(path => ({
        url: `${BASE}${path}`,
        lastModified: now,
        changeFrequency: 'monthly' as string,
        priority: path === '/calc' ? 0.9 : 0.8,
      })),
      ...REGIONS.map(r => ({
        url: `${BASE}/apt/region/${encodeURIComponent(r)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      ...SECTORS.map(s => ({
        url: `${BASE}/stock/sector/${encodeURIComponent(s)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      // 카더라 데일리 리포트 — 17개 지역
      ...['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].flatMap(r => [
        { url: `${BASE}/daily/${encodeURIComponent(r)}`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
        { url: `${BASE}/daily/${encodeURIComponent(r)}/archive`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
      ]),
      // 테마 페이지 (투자자 검색 키워드) — 6테마 × (전국 + 17지역) = 108 URL
      ...THEME_SLUGS.flatMap(t => [
        { url: `${BASE}/apt/theme/${t}`, lastModified: now, changeFrequency: 'weekly' as string, priority: 0.8 },
        ...THEME_REGIONS.map(r => ({ url: `${BASE}/apt/theme/${t}?region=${encodeURIComponent(r)}`, lastModified: now, changeFrequency: 'weekly' as string, priority: 0.7 })),
      ]),
    ];
    return xmlResponse(entries);
  }

  // ── 1: stock ──
  if (id === 1) {
    try {
      const sb = getSupabaseAdmin();
      // s214 #1: PostgREST 1000 cap 우회 — fetchBatched 로 1846 종목 모두 수집
      const data = await fetchBatched<any>((off, lim) =>
        sb.from('stock_quotes')
          .select('symbol, updated_at')
          .eq('is_active', true)
          .gt('price', 0)
          .order('symbol', { ascending: true })
          .range(off, off + lim - 1),
        10000,
      );
      return xmlResponse(data.map(s => ({
        url: `${BASE}/stock/${s.symbol}`,
        lastModified: s.updated_at || now,
        changeFrequency: 'daily',
        priority: 0.8,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 2: apt-sites ──
  if (id === 2) {
    try {
      const sb = getSupabaseAdmin();
      // s214 #2: PostgREST 1000 cap 우회 — fetchBatched 로 5,799 단지 모두 수집
      const data = await fetchBatched<any>((off, lim) =>
        sb.from('apt_sites')
          .select('slug, updated_at, site_type, interest_count')
          .eq('is_active', true).gte('content_score', 25)
          .order('interest_count', { ascending: false })
          .range(off, off + lim - 1),
        10000,
      );
      const typePriority: Record<string, number> = { subscription: 0.85, trade: 0.8, redevelopment: 0.75, unsold: 0.7, landmark: 0.8 };
      const typeFreq: Record<string, string> = { subscription: 'daily', trade: 'weekly', redevelopment: 'weekly', unsold: 'weekly', landmark: 'monthly' };
      return xmlResponse(data.map((s: any) => ({
        url: `${BASE}/apt/${s.slug}`,
        lastModified: s.updated_at || now,
        changeFrequency: typeFreq[s.site_type] || 'weekly',
        priority: s.interest_count > 0 ? Math.min((typePriority[s.site_type] || 0.7) + 0.05, 0.95) : typePriority[s.site_type] || 0.7,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 3: feed posts (시드 게시글 제외 — SEO 품질 보호) ──
  if (id === 3) {
    try {
      const sb = getSupabaseAdmin();
      // s214 #3: PostgREST 1000 cap 우회 — fetchBatched 로 7,184 posts 모두 (seed 필터 후 SEO 품질 보호)
      const data = await fetchBatched<any>((off, lim) =>
        sb.from('posts')
          .select('id, slug, updated_at, created_at, author_id')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .range(off, off + lim - 1),
        10000,
      );
      // 시드 유저 목록 조회 (1000 cap 안 걸림 — seed 유저 적음)
      const { data: seedUsers } = await sb.from('profiles').select('id').eq('is_seed', true);
      const seedIds = new Set((seedUsers || []).map((u: any) => u.id));
      const filtered = data.filter((p: any) => !seedIds.has(p.author_id));
      return xmlResponse(filtered.map((p: any) => ({
        url: `${BASE}/feed/${p.slug || p.id}`,
        lastModified: p.updated_at || p.created_at || now,
        changeFrequency: 'weekly',
        priority: 0.5,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 4: discuss ──
  if (id === 4) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from('discussion_topics')
        .select('id, created_at, comment_count, vote_a, vote_b')
        .order('created_at', { ascending: false }).limit(1000);
      return xmlResponse((data || []).map((d: any) => {
        const engagement = (d.vote_a || 0) + (d.vote_b || 0) + (d.comment_count || 0);
        return {
          url: `${BASE}/discuss/${d.id}`,
          lastModified: d.created_at || now,
          changeFrequency: 'weekly',
          priority: engagement > 50 ? 0.7 : engagement > 10 ? 0.6 : 0.5,
        };
      }));
    } catch { return xmlResponse([]); }
  }

  // ── 5~7: complex profiles (단지백과) + image 태그 ──
  const COMPLEX_PER_SITEMAP = 12000;
  if (id >= 5 && id <= 7) {
    try {
      const sb = getSupabaseAdmin();
      const chunk = id - 5;
      const baseOffset = chunk * COMPLEX_PER_SITEMAP;
      // s214 #1+2+3: PostgREST 1000 cap 우회 — fetchBatched 로 chunk 12000 row 모두 수집.
      // chunk 0: 0..11999, chunk 1: 12000..23999, chunk 2: 24000..34543 (총 34,544).
      const data = await fetchBatched<any>((off, lim) =>
        (sb as any).from('apt_complex_profiles')
          .select('apt_name, region_nm, sigungu, updated_at, sale_count_1y, rent_count_1y')
          .not('age_group', 'is', null)
          .order('sale_count_1y', { ascending: false })
          .range(baseOffset + off, baseOffset + off + lim - 1),
        COMPLEX_PER_SITEMAP,
      );

      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const complexXml = (data || []).map((p: any) => {
        const activity = (p.sale_count_1y || 0) + (p.rent_count_1y || 0);
        const prio = activity > 100 ? 0.8 : activity > 20 ? 0.7 : 0.6;
        const freq = activity > 50 ? 'weekly' : 'monthly';
        return `  <url>
    <loc>${BASE}/apt/complex/${encodeURIComponent(p.apt_name)}</loc>
    <lastmod>${p.updated_at || now}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
    <image:image>
      <image:loc>${BASE}/api/og?title=${encodeURIComponent(p.apt_name)}&amp;design=2&amp;category=apt</image:loc>
      <image:title>${esc(p.apt_name)} 아파트 실거래가</image:title>
      <image:caption>${esc((p.region_nm || '') + ' ' + (p.sigungu || '') + ' ' + p.apt_name)} 시세</image:caption>
    </image:image>
  </url>`;
      }).join('\n');

      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${complexXml}
</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
    } catch { return xmlResponse([]); }
  }

  // ── 21: area hubs (시군구 + 동 허브) ──
  if (id === 21) {
    try {
      const sb = getSupabaseAdmin();
      const entries: SitemapEntry[] = [];
      // 시군구 (10개+ 단지만)
      // s216 (S215.5 #1,2,3): PostgREST 1k cap 우회 — apt_complex_profiles 34k / apt_sites 5.8k 전수 집계.
      // 기존엔 1k 만 받아 시군구/동/건설사 hub URL 이 사이트맵에서 광범위 누락.
      const sgd = await fetchBatched<{ region_nm: string; sigungu: string }>((off, lim) =>
        (sb as any).from('apt_complex_profiles').select('region_nm, sigungu')
          .not('age_group', 'is', null).not('sigungu', 'is', null)
          .order('apt_name', { ascending: true }).range(off, off + lim - 1),
        100000,
      );
      const sgMap = new Map<string, number>();
      for (const r of sgd) { const k = `${r.region_nm}|${r.sigungu}`; sgMap.set(k, (sgMap.get(k) || 0) + 1); }
      for (const [k, c] of sgMap) { if (c < 10) continue; const [reg, sg] = k.split('|'); if (!reg || !sg) continue; entries.push({ url: `${BASE}/apt/area/${encodeURIComponent(reg)}/${encodeURIComponent(sg)}`, lastModified: now, changeFrequency: 'weekly', priority: c > 200 ? 0.85 : c > 50 ? 0.75 : 0.65 }); }
      // 동 (5개+ 단지만)
      const dd = await fetchBatched<{ region_nm: string; sigungu: string; dong: string }>((off, lim) =>
        (sb as any).from('apt_complex_profiles').select('region_nm, sigungu, dong')
          .not('age_group', 'is', null).not('dong', 'is', null).neq('dong', '')
          .order('apt_name', { ascending: true }).range(off, off + lim - 1),
        100000,
      );
      const dMap = new Map<string, number>();
      for (const r of dd) { const k = `${r.region_nm}|${r.sigungu}|${r.dong}`; dMap.set(k, (dMap.get(k) || 0) + 1); }
      for (const [k, c] of dMap) { if (c < 5) continue; const [reg, sg, dg] = k.split('|'); if (!reg || !sg || !dg) continue; entries.push({ url: `${BASE}/apt/area/${encodeURIComponent(reg)}/${encodeURIComponent(sg)}/${encodeURIComponent(dg)}`, lastModified: now, changeFrequency: 'monthly', priority: c > 30 ? 0.7 : 0.6 }); }
      // 건설사 (3개+ 현장만)
      const bd = await fetchBatched<{ builder: string | null }>((off, lim) =>
        sb.from('apt_sites').select('builder').eq('is_active', true)
          .not('builder', 'is', null).neq('builder', '')
          .order('id', { ascending: true }).range(off, off + lim - 1),
        20000,
      );
      const bMap = new Map<string, number>();
      for (const r of bd) { if (r.builder) bMap.set(r.builder, (bMap.get(r.builder) || 0) + 1); }
      for (const [b, c] of bMap) { if (c < 3) continue; entries.push({ url: `${BASE}/apt/builder/${encodeURIComponent(b)}`, lastModified: now, changeFrequency: 'monthly', priority: c > 20 ? 0.75 : 0.6 }); }
      // 비교 페이지 — 인기 시군구 상위 단지 조합 (스팸 방지: 최대 200개)
      try {
        const { data: topComplexes } = await (sb as any).from('apt_complex_profiles')
          .select('apt_name, sigungu').not('age_group', 'is', null).gt('sale_count_1y', 20).gt('latest_sale_price', 0)
          .order('sale_count_1y', { ascending: false }).limit(100);
        if (topComplexes) {
          const bySg = new Map<string, string[]>();
          for (const c of topComplexes) { if (!c.sigungu) continue; const arr = bySg.get(c.sigungu) || []; if (arr.length < 4) arr.push(c.apt_name); bySg.set(c.sigungu, arr); }
          let compareCount = 0;
          for (const [, names] of bySg) {
            for (let i = 0; i < names.length && compareCount < 200; i++) {
              for (let j = i + 1; j < names.length && compareCount < 200; j++) {
                entries.push({ url: `${BASE}/apt/compare/${encodeURIComponent(names[i])}-vs-${encodeURIComponent(names[j])}`, lastModified: now, changeFrequency: 'monthly', priority: 0.55 });
                compareCount++;
              }
            }
          }
        }
      } catch {}
      return xmlResponse(entries);
    } catch { return xmlResponse([]); }
  }

  // ── 12: stock-vs 비교 페이지 ──
  if (id === 12) {
    try {
      const sb = getSupabaseAdmin();
      const entries: SitemapEntry[] = [];

      // 종목 비교 (인기 종목 조합 — 최대 200개)
      try {
        const { data: topStocks } = await sb.from('stock_quotes')
          .select('symbol, name, market')
          .eq('is_active', true).gt('price', 0)
          .order('market_cap', { ascending: false }).limit(50);
        if (topStocks) {
          const kospi = topStocks.filter((s: any) => s.market === 'KOSPI').slice(0, 15);
          const kosdaq = topStocks.filter((s: any) => s.market === 'KOSDAQ').slice(0, 10);
          const groups = [kospi, kosdaq];
          let vsCount = 0;
          for (const group of groups) {
            for (let i = 0; i < group.length && vsCount < 200; i++) {
              for (let j = i + 1; j < group.length && vsCount < 200; j++) {
                entries.push({
                  url: `${BASE}/stock/${group[i].symbol}/vs/${group[j].symbol}`,
                  lastModified: now,
                  changeFrequency: 'weekly',
                  priority: 0.55,
                });
                vsCount++;
              }
            }
          }
        }
      } catch {}

      return xmlResponse(entries);
    } catch { return xmlResponse([]); }
  }

  // ── 13: glossary (stock_glossary 용어사전) ──
  if (id === 13) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await (sb as any).from('stock_glossary')
        .select('slug, created_at')
        .not('slug', 'is', null)
        .neq('slug', '');
      return xmlResponse((data || []).map((g: any) => ({
        url: `${BASE}/glossary/${encodeURIComponent(g.slug)}`,
        lastModified: g.created_at || now,
        changeFrequency: 'monthly',
        priority: 0.65,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 14: daily_reports archive (지역별 일일 리포트 히스토리) ──
  if (id === 14) {
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from('daily_reports')
        .select('region, report_date, created_at')
        .not('region', 'is', null)
        .not('report_date', 'is', null)
        .order('report_date', { ascending: false })
        .limit(10000);
      return xmlResponse((data || []).map((d: any) => {
        // report_date는 date 타입 — YYYY-MM-DD 형식 그대로 URL에 사용
        const dateStr = typeof d.report_date === 'string'
          ? d.report_date.slice(0, 10)
          : new Date(d.report_date).toISOString().slice(0, 10);
        const daysSince = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
        return {
          url: `${BASE}/daily/${encodeURIComponent(d.region)}/${dateStr}`,
          lastModified: d.created_at || dateStr,
          changeFrequency: daysSince <= 7 ? 'daily' : daysSince <= 30 ? 'weekly' : 'monthly',
          priority: daysSince <= 3 ? 0.8 : daysSince <= 14 ? 0.65 : 0.5,
        };
      }));
    } catch { return xmlResponse([]); }
  }

  // ── 15: /stock/[symbol]/chart (종목별 차트 페이지) ──
  if (id === 15) {
    try {
      const sb = getSupabaseAdmin();
      // s217: PostgREST 1k cap 우회 — fetchBatched 로 1,846 종목 모두 수집 (s214 누락분).
      const data = await fetchBatched<any>((off, lim) =>
        sb.from('stock_quotes')
          .select('symbol, updated_at')
          .eq('is_active', true)
          .gt('price', 0)
          .order('symbol', { ascending: true })
          .range(off, off + lim - 1),
        10000,
      );
      return xmlResponse(data.map(s => ({
        url: `${BASE}/stock/${s.symbol}/chart`,
        lastModified: s.updated_at || now,
        changeFrequency: 'daily',
        priority: 0.6,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 16: /stock/[symbol]/financials (종목별 재무 페이지) ──
  if (id === 16) {
    try {
      const sb = getSupabaseAdmin();
      // s217: PostgREST 1k cap 우회 — fetchBatched 로 1,846 종목 모두 수집 (s214 누락분).
      const data = await fetchBatched<any>((off, lim) =>
        sb.from('stock_quotes')
          .select('symbol, updated_at')
          .eq('is_active', true)
          .gt('price', 0)
          .order('symbol', { ascending: true })
          .range(off, off + lim - 1),
        10000,
      );
      return xmlResponse(data.map(s => ({
        url: `${BASE}/stock/${s.symbol}/financials`,
        lastModified: s.updated_at || now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 8~29: blog chunks (image 사이트맵 포함) — id 30+ 는 별도 핸들러 ──
  if (id >= 8 && id < 30) {
    try {
      const sb = getSupabaseAdmin();
      const chunk = id - 8;
      const baseOffset = chunk * BLOG_PER_SITEMAP;
      // s214 #1+2+3: PostgREST 1000 cap 우회 — chunk 5,000 row 모두 수집 (이전엔 첫 1000 만).
      // 8,145 blog → chunks 0,1 = 5000 + 3145 = 모두 cover.
      const data = await fetchBatched<any>((off, lim) =>
        sb.from('blog_posts')
          .select('slug, title, updated_at, published_at, cover_image, image_alt, category, source_type')
          .eq('is_published', true).not('published_at', 'is', null)
          .lte('published_at', now)
          .order('published_at', { ascending: false })
          .range(baseOffset + off, baseOffset + off + lim - 1),
        BLOG_PER_SITEMAP,
      );

      // 빈 사이트맵 (구글에 "이 카테고리의 콘텐츠가 사라졌다" 신호) 차단
      // chunk 0 (=id 8)은 항상 200 유지 (DB 일시 에러 시 보호) — 이후 청크는 데이터 없으면 410.
      if (chunk > 0 && (!data || data.length === 0)) {
        return new NextResponse('Sitemap chunk no longer exists', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      let seriesEntries: SitemapEntry[] = [];
      if (chunk === 0) {
        try {
          const { data: series } = await sb.from('blog_series').select('slug, created_at, updated_at').eq('is_active', true);
          seriesEntries = (series || []).map((s: any) => ({
            url: `${BASE}/blog/series/${s.slug}`,
            lastModified: s.updated_at || s.created_at || now,
            changeFrequency: 'weekly',
            priority: 0.7,
          }));
        } catch {}
      }

      // image 사이트맵 포함 XML 생성
      const escXml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const blogXml = (data || []).map(b => {
        const pubDate = new Date(b.published_at || b.updated_at || now);
        const daysSincePub = Math.floor((Date.now() - pubDate.getTime()) / 86400000);
        const freq = daysSincePub <= 7 ? 'daily' : daysSincePub <= 30 ? 'weekly' : 'monthly';
        const prio = b.source_type === 'upcoming' ? 0.9 : daysSincePub <= 3 ? 0.8 : daysSincePub <= 14 ? 0.7 : daysSincePub <= 60 ? 0.6 : 0.5;
        const lastmod = b.updated_at || b.published_at || now;
        const rawImg = b.cover_image || `${BASE}/api/og?title=${encodeURIComponent((b.title || '').slice(0, 60))}&category=${b.category || 'blog'}&design=2`;
        const imgUrl = rawImg.startsWith('/') ? `${BASE}${rawImg}` : rawImg;
        const imgAlt = escXml(b.image_alt || b.title || '카더라 블로그');
        const imgTitle = escXml((b.title || '').slice(0, 80));
        return `  <url>
    <loc>${BASE}/blog/${b.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
    <image:image>
      <image:loc>${escXml(imgUrl)}</image:loc>
      <image:title>${imgTitle}</image:title>
      <image:caption>${imgAlt}</image:caption>
    </image:image>
    <image:image>
      <image:loc>${BASE}/api/og-infographic?title=${encodeURIComponent((b.title || '').slice(0, 40))}&amp;category=${b.category || 'blog'}&amp;type=summary</image:loc>
      <image:title>${escXml(b.title + ' 인포그래픽')}</image:title>
      <image:caption>${imgAlt}</image:caption>
    </image:image>
  </url>`;
      }).join('\n');

      const seriesXml = seriesEntries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastModified}</lastmod>
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');

      const fullXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${seriesXml}
${blogXml}
</urlset>`;

      return new NextResponse(fullXml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch { return xmlResponse([]); }
  }

  // ── 30: 계산기 토픽 클러스터 (RPC: get_calc_topic_sitemap_urls — SECURITY DEFINER + EXCEPTION 내장) ──
  if (id === 30) {
    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await (sb as any).rpc('get_calc_topic_sitemap_urls');
      if (error) {
        console.error('[sitemap/30] rpc error:', error);
        return new NextResponse(`<!-- sitemap30 rpc error: ${error.message} -->\n<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`, {
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        });
      }
      const entries = (Array.isArray(data) ? data : []).map((r: any) => ({
        url: r.url,
        lastModified: r.last_modified ? new Date(r.last_modified).toISOString() : buildDate,
        changeFrequency: r.change_freq || 'weekly',
        priority: typeof r.priority === 'number' ? r.priority : Number(r.priority) || 0.7,
      }));
      return xmlResponse(entries);
    } catch (e: any) {
      console.error('[sitemap/30] catch:', e);
      return new NextResponse(`<!-- sitemap30 catch: ${e?.message || e} -->\n<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }
  }

  // ── 31: 인기 계산기 결과 영구 URL (조회수 5+) ──
  if (id === 31) {
    try {
      const sb = getSupabaseAdmin();
      const { data: results, error } = await (sb as any).from('calc_results')
        .select('short_id, calc_slug, calc_category, view_count, created_at')
        .gt('view_count', 5)
        .gt('expires_at', new Date().toISOString())
        .order('view_count', { ascending: false })
        .limit(1000);
      if (error) {
        console.error('[sitemap/31] supabase error:', error);
        return xmlResponse([]);
      }
      const entries = (results || []).map((r: any) => ({
        url: `${BASE}/calc/${encodeURIComponent(r.calc_category)}/${encodeURIComponent(r.calc_slug)}/r/${encodeURIComponent(r.short_id)}`,
        lastModified: r.created_at ? new Date(r.created_at).toISOString() : buildDate,
        changeFrequency: 'monthly',
        priority: r.view_count > 100 ? 0.7 : r.view_count > 50 ? 0.6 : 0.5,
      }));
      return xmlResponse(entries);
    } catch (e) {
      console.error('[sitemap/31] catch:', e);
      return xmlResponse([]);
    }
  }

  // 알려진 핸들러에 매칭되지 않는 id (가령 /sitemap/99.xml 같은 stale URL)은 404로 처리
  // — 빈 200 응답이 구글에 "이 사이트맵 살아있음, 콘텐츠 없음" 신호를 주는 것을 방지.
  return new NextResponse('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
