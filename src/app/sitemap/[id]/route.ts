import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as BASE } from '@/lib/constants';
import { fetchBatched, POSTGREST_BATCH } from '@/lib/db/fetchBatched';
// r4-P5-4: 신규 경로는 sitemap.xml 인덱스를 건드리지 않도록 id=0 에 싣는다.
import { fetchIndexableStagePairs } from '@/lib/apt/stage';
import { SITE_INDEX_MIN_SCORE } from '@/lib/apt/site-indexable';
import { listArchiveMonths } from '@/lib/blog/archive';

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
  /**
   * ABG 증분 2 — 「거짓 신선도 신호 금지 — 추적 불가면 생략」. 실갱신 이벤트(발행·재작성·생성)가 없으면 null → <lastmod> 를 싣지 않는다.
   * ⛔ now·빌드 고정일·updated_at(blog_posts 는 트리거 없음 · apt_sites 는 sync 가 매 실행 갱신)을 쓰지 않는다.
   */
  lastModified: string | null;
  changeFrequency: string;
  priority: number;
}

function toXml(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.url}</loc>
${e.lastModified ? `    <lastmod>${e.lastModified}</lastmod>\n` : ''}    <changefreq>${e.changeFrequency}</changefreq>
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
      // ⛔ A4 — '/feed'(→/apt 302) 와 '/discuss'(noindex) 를 정적 항목에서 뺐다.
      //    302·noindex 를 사이트맵에 제출하면 「차단된 URL 제출」 경고가 뜬다.
      // ⛔ AD-4(2026-09-07) — '/hot' · '/shop' · '/grades' 를 뺐다. 그 셋은 noindex 다.
      //    사이트맵은 「이걸 색인해 달라」는 요청이라, noindex 를 걸어 놓고 여기 남기면
      //    크롤러에게 앞뒤가 다른 말을 하는 셈이고 크롤 예산만 샌다.
      //    ⚠️ 라우트는 살아 있다. 직접 주소로는 그대로 들어간다.
      '', '/stock', '/apt', '/blog', '/about',
      '/guide', '/search', '/faq', '/terms', '/privacy', '/refund',
      // s274: '/apt/map' 과 '/apt/data' 는 robots.txt 에서 Disallow (s235 dead route) 인데
      // 사이트맵에는 남아 있어 "차단된 URL 을 제출" 경고가 뜬다. 사이트맵에서 제외.
      // (사용자용 링크는 유지 — Disallow 는 크롤러에만 적용된다.)
      '/apt/diagnose', '/apt/complex', '/apt/redev', '/stock/compare', '/blog/series',
      '/stock/data', '/stock/search', '/stock/dividend', '/stock/movers', '/stock/themes',
      '/stock/market/kospi', '/stock/market/kosdaq', '/stock/market/nyse', '/stock/market/nasdaq',
      '/stock/short-selling', '/stock/signals',
      // ⛔ 2026-09-07 — '/premium' 을 뺐다. 오늘 접혀 홈으로 301 된다.
      //    301 되는 주소를 사이트맵에 남기면 크롤러에게 앞뒤가 다른 말을 하는 것이다
      //    (AD-4 가 /hot·/shop·/grades 를 뺀 것과 같은 이유).
      '/calc', '/press', '/glossary', '/more',
      // r4-P5-3: 주식 국내/해외 2분할
      '/stock/domestic', '/stock/overseas',
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
        lastModified: null,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : ['/feed', '/stock', '/apt'].includes(path) ? 0.9 : 0.7,
      })),
      ...calcPaths.map(path => ({
        url: `${BASE}${path}`,
        lastModified: null,
        changeFrequency: 'monthly' as string,
        priority: path === '/calc' ? 0.9 : 0.8,
      })),
      ...REGIONS.map(r => ({
        url: `${BASE}/apt/region/${encodeURIComponent(r)}`,
        lastModified: null,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      ...SECTORS.map(s => ({
        url: `${BASE}/stock/sector/${encodeURIComponent(s)}`,
        lastModified: null,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      // 카더라 데일리 리포트 — 17개 지역
      ...['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].flatMap(r => [
        { url: `${BASE}/daily/${encodeURIComponent(r)}`, lastModified: null, changeFrequency: 'daily', priority: 0.85 },
        { url: `${BASE}/daily/${encodeURIComponent(r)}/archive`, lastModified: null, changeFrequency: 'weekly', priority: 0.5 },
      ]),
      // 테마 페이지 (투자자 검색 키워드) — 6테마 × (전국 + 17지역) = 108 URL
      ...THEME_SLUGS.flatMap(t => [
        { url: `${BASE}/apt/theme/${t}`, lastModified: null, changeFrequency: 'weekly' as string, priority: 0.8 },
        ...THEME_REGIONS.map(r => ({ url: `${BASE}/apt/theme/${t}?region=${encodeURIComponent(r)}`, lastModified: null, changeFrequency: 'weekly' as string, priority: 0.7 })),
      ]),
    ];

    // r4-P5-4: lifecycle 축 + 블로그 월별 아카이브.
    // isIndexable 통과분만 싣는다 — 페이지 본문 가드와 같은 함수를 쓴다.
    // 실패해도 나머지 사이트맵은 나가야 하므로 개별 try 로 감싼다.
    try {
      const pairs = await fetchIndexableStagePairs();
      for (const p of pairs) {
        entries.push({
          url: `${BASE}/apt/stage/${p.stage}/${encodeURIComponent(p.region)}`,
          lastModified: null,
          changeFrequency: p.stage === 'offering' ? 'daily' : 'weekly',
          priority: p.stage === 'offering' ? 0.85 : 0.75,
        });
      }
    } catch (e) { console.error('[sitemap/0] apt stage', e); }

    try {
      const months = await listArchiveMonths();
      for (const m of months) {
        entries.push({
          url: `${BASE}/blog/archive/${m}`,
          lastModified: null,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    } catch (e) { console.error('[sitemap/0] blog archive', e); }

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
        lastModified: null,
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
          // K-5 — 본문·메타 noindex 와 «같은 값» 이다(site-indexable.ts). 숫자를 여기 적지 않는다.
          //   예전엔 25 라서, 25~39 구간이 「사이트맵엔 실리는데 본문은 noindex」였다.
          .eq('is_active', true).gte('content_score', SITE_INDEX_MIN_SCORE)
          .order('interest_count', { ascending: false })
          .range(off, off + lim - 1),
        10000,
      );
      const typePriority: Record<string, number> = { subscription: 0.85, trade: 0.8, redevelopment: 0.75, unsold: 0.7, landmark: 0.8 };
      const typeFreq: Record<string, string> = { subscription: 'daily', trade: 'weekly', redevelopment: 'weekly', unsold: 'weekly', landmark: 'monthly' };
      return xmlResponse(data.map((s: any) => ({
        url: `${BASE}/apt/${s.slug}`,
        lastModified: null,
        changeFrequency: typeFreq[s.site_type] || 'weekly',
        priority: s.interest_count > 0 ? Math.min((typePriority[s.site_type] || 0.7) + 0.05, 0.95) : typePriority[s.site_type] || 0.7,
      })));
    } catch { return xmlResponse([]); }
  }

  // ── 3: feed posts (시드 게시글 제외 — SEO 품질 보호) ──
  if (id === 3) {
    try {
      const sb = getSupabaseAdmin();
      // [§8] 시드 제외를 «DB 쿼리로» 내린다.
      //
      //   이전 구현은 fetchBatched(..., 10000) 로 최신 1만 건을 먼저 가져온 뒤
      //   애플리케이션에서 시드를 걸렀다. posts 는 12,825건(미삭제)이고 그중
      //   12,524건이 시드라, 오래된 2,825건이 «시드 판정 전에» 잘려나가면서
      //   실유저 글 300건 중 188건이 사이트맵에서 통째로 빠져 있었다.
      //   (검증 2026-08-25 — 최신 1만 건 중 실유저 글 112건 = 라이브 사이트맵 113건.)
      //
      //   한도만 올리면 posts 가 더 쌓일 때 같은 방식으로 또 터진다.
      //   profiles!inner 조인 필터로 «거른 뒤 페이징» 하도록 순서를 뒤집었다.
      //   is_seed 는 null 이 없음을 확인했으므로 eq(false) 로 정확히 갈린다.
      //   시드 12,524건 제외 자체는 의도된 품질 게이트이므로 그대로 유지한다.
      const filtered = await fetchBatched<any>((off, lim) =>
        sb.from('posts')
          // FK 이름을 «반드시» 명시한다. `profiles!inner` 로만 쓰면 PGRST201 로 죽는다 —
          // posts↔profiles 는 직접 FK 말고도 bookmarks·post_downvotes·post_likes 를 통한
          // 다대다 경로가 있어서 PostgREST 가 관계를 특정하지 못한다.
          // fetchBatched 가 error 를 조용히 삼키고 [] 를 돌려주므로 사이트맵이 0건이 된다.
          .select('id, slug, updated_at, created_at, profiles!posts_author_id_fkey!inner(is_seed)')
          .eq('is_deleted', false)
          .eq('profiles.is_seed', false)
          .order('created_at', { ascending: false })
          .range(off, off + lim - 1),
        10000,
      );
      // fetchBatched 는 PostgREST error 를 삼키고 [] 를 돌려준다. 그래서 쿼리가
      // 깨져도 «빈 사이트맵이 200 으로» 나가 정상처럼 보인다 — 실제로 PGRST201
      // 때문에 300건이 0건으로 나간 적이 있다. 0건은 항상 이상 신호이므로 남긴다.
      if (filtered.length === 0) {
        console.error('[sitemap/3] 커뮤니티 글 0건 — 쿼리 실패 의심(PostgREST 관계·필터 확인)');
      }
      return xmlResponse(filtered.map((p: any) => ({
        url: `${BASE}/feed/${p.slug || p.id}`,
        lastModified: p.created_at || null,
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
          lastModified: d.created_at || null,
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
          // K-5 — 서술 없는 단지백과는 색인 대상이 아니다.
          //   `age_group IS NOT NULL` 은 39,673 «전부» 를 통과시켜 필터 구실을 못 했다.
          //   품질 게이트로 쓰이던 data_quality_score/quality_score 는 «이 표에 없는 열» 이라
          //   한 번도 걸린 적이 없다(complex/[name]/page.tsx 의 사문 게이트). 실존 신호로 바꾼다.
          //   실측(30일): 서술 없는 12,698 페이지의 네이버 유입은 «6회» 이고 서로 다른 6페이지에
          //   1회씩 흩어져 있었다 — 집중이 없어 예외 화이트리스트를 두지 않는다.
          //   ⚠️ narrative_text IS NOT NULL 은 length>=50 과 «정확히 동치» 다(짧은 비-NULL 0건 실측).
          .not('narrative_text', 'is', null)
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
      for (const [k, c] of sgMap) { if (c < 10) continue; const [reg, sg] = k.split('|'); if (!reg || !sg) continue; entries.push({ url: `${BASE}/apt/area/${encodeURIComponent(reg)}/${encodeURIComponent(sg)}`, lastModified: null, changeFrequency: 'weekly', priority: c > 200 ? 0.85 : c > 50 ? 0.75 : 0.65 }); }
      // 동 (5개+ 단지만)
      const dd = await fetchBatched<{ region_nm: string; sigungu: string; dong: string }>((off, lim) =>
        (sb as any).from('apt_complex_profiles').select('region_nm, sigungu, dong')
          .not('age_group', 'is', null).not('dong', 'is', null).neq('dong', '')
          .order('apt_name', { ascending: true }).range(off, off + lim - 1),
        100000,
      );
      const dMap = new Map<string, number>();
      for (const r of dd) { const k = `${r.region_nm}|${r.sigungu}|${r.dong}`; dMap.set(k, (dMap.get(k) || 0) + 1); }
      for (const [k, c] of dMap) { if (c < 5) continue; const [reg, sg, dg] = k.split('|'); if (!reg || !sg || !dg) continue; entries.push({ url: `${BASE}/apt/area/${encodeURIComponent(reg)}/${encodeURIComponent(sg)}/${encodeURIComponent(dg)}`, lastModified: null, changeFrequency: 'monthly', priority: c > 30 ? 0.7 : 0.6 }); }
      // 건설사 (3개+ 현장만)
      // ⚠️ M2 B-2: 원문 builder 가 아니라 builder_normalized 를 센다.
      //    허브가 contains(builder_normalized) 로 조회하므로 사이트맵이 원문을 그대로
      //    실으면 "GS건설, SK에코플랜트" 같은 URL 을 내보내게 되고 그 페이지는 비어 있다.
      //    세는 단위도 달라진다 — 컨소시엄 행은 참여사 각각에 1건씩 잡힌다.
      const bd = await fetchBatched<{ builder_normalized: string[] | null }>((off, lim) =>
        sb.from('apt_sites').select('builder_normalized').eq('is_active', true)
          .not('builder_normalized', 'is', null)
          .order('id', { ascending: true }).range(off, off + lim - 1),
        20000,
      );
      const bMap = new Map<string, number>();
      for (const r of bd) {
        for (const b of (r.builder_normalized ?? [])) bMap.set(b, (bMap.get(b) || 0) + 1);
      }
      for (const [b, c] of bMap) { if (c < 3) continue; entries.push({ url: `${BASE}/apt/builder/${encodeURIComponent(b)}`, lastModified: null, changeFrequency: 'monthly', priority: c > 20 ? 0.75 : 0.6 }); }
      // ⛔ K-10 ③ — 비교 페이지(/apt/compare/…)는 «사이트맵에서 뺀다» (2026-09-16 실측 판정).
      //   여기 있던 「인기 시군구 상위 단지 조합 최대 200개」 생성기를 걷어냈다.
      //   단가: 30일 네이버 유입 «11회»(8페이지 산발) 대 하루 수백 건의 504.
      //   [slugs] 가 아무 쌍이나 받는 조합 폭발 표면이라 크롤러는 이 200 을 훨씬 넘겨 훑고,
      //   그것이 봇 대면 5xx 상위 3위 경로를 만들었다.
      //   ⚠️ 페이지 메타도 «같은 커밋에서» noindex 로 바꿨다(apt/compare/[slugs]/page.tsx).
      //      제출과 색인 방침이 갈리면 「차단된 URL 제출」 경고가 난다 — K-5 에서 닫은 그 자기모순.
      //   ⚠️ 라우트는 존치한다. 내부 링크로 들어오는 사람 동선은 그대로다.
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
                  lastModified: null,
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
        lastModified: g.created_at || null,
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
        lastModified: null,
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
        lastModified: null,
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
          .select('slug, title, updated_at, published_at, rewritten_at, cover_image, image_alt, category, source_type')
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
            lastModified: null,
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
        // 발행 이후 재작성(rewritten_at)만 수정 이벤트다. 없으면 발행일.
        const lastmod = b.rewritten_at && b.published_at && Date.parse(b.rewritten_at) > Date.parse(b.published_at) ? b.rewritten_at : (b.published_at || null);
        const rawImg = b.cover_image || `${BASE}/api/og?title=${encodeURIComponent((b.title || '').slice(0, 60))}&category=${b.category || 'blog'}&design=2`;
        const imgUrl = rawImg.startsWith('/') ? `${BASE}${rawImg}` : rawImg;
        const imgAlt = escXml(b.image_alt || b.title || '카더라 블로그');
        const imgTitle = escXml((b.title || '').slice(0, 80));

        // s261: apt/unsold 카테고리 글에는 og-apt 6장 추가 (이미지 캐러셀 자격 강화)
        let extraCardsXml = '';
        if ((b.category === 'apt' || b.category === 'unsold') && b.slug) {
          const types = ['cover','metric','units','timing','place','spec'];
          extraCardsXml = types.map((t, i) => `    <image:image>
      <image:loc>${BASE}/api/og-apt?slug=${encodeURIComponent(b.slug)}&amp;card=${i + 1}&amp;v=1</image:loc>
      <image:title>${escXml((b.title || '').slice(0, 80) + ' ' + t)}</image:title>
      <image:caption>${imgAlt}</image:caption>
    </image:image>`).join('\n');
        }

        return `  <url>
    <loc>${BASE}/blog/${b.slug}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${freq}</changefreq>
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
    </image:image>${extraCardsXml ? '\n' + extraCardsXml : ''}
  </url>`;
      }).join('\n');

      const seriesXml = seriesEntries.map(e => `  <url>
    <loc>${e.url}</loc>
${e.lastModified ? `    <lastmod>${e.lastModified}</lastmod>\n` : ''}    <changefreq>${e.changeFrequency}</changefreq>
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
        lastModified: r.last_modified ? new Date(r.last_modified).toISOString() : null,
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
        lastModified: r.created_at ? new Date(r.created_at).toISOString() : null,
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
