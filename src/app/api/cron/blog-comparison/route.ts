export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  부동산 18쌍 — [regionA, sigunguA, regionB, sigunguB]               */
/* ------------------------------------------------------------------ */
const APT_PAIRS: [string, string, string, string][] = [
  ['부산', '해운대구', '부산', '수영구'],
  ['서울', '강남구', '서울', '서초구'],
  ['서울', '송파구', '서울', '강동구'],
  ['서울', '마포구', '서울', '용산구'],
  ['경기', '수원시', '경기', '용인시'],
  ['경기', '성남시', '경기', '하남시'],
  ['인천', '연수구', '인천', '남동구'],
  ['대구', '수성구', '대구', '달서구'],
  ['대전', '유성구', '대전', '서구'],
  ['광주', '동구', '광주', '북구'],
  ['경기', '화성시', '경기', '평택시'],
  ['경기', '김포시', '경기', '파주시'],
  ['경남', '양산시', '경남', '김해시'],
  ['전북', '전주시', '전북', '군산시'],
  ['충남', '천안시', '충남', '아산시'],
  ['강원', '춘천시', '강원', '원주시'],
  ['경북', '경주시', '경북', '포항시'],
  ['제주', '제주시', '제주', '서귀포시'],
];

/* ------------------------------------------------------------------ */
/*  주식 10쌍 — [symbolA, symbolB]                                     */
/* ------------------------------------------------------------------ */
const STOCK_PAIRS: [string, string][] = [
  ['005930', '000660'],   // 삼성전자 vs SK하이닉스
  ['005380', '000270'],   // 현대차 vs 기아
  ['035420', '035720'],   // NAVER vs 카카오
  ['006400', '373220'],   // 삼성SDI vs LG에너지솔루션
  ['105560', '055550'],   // KB금융 vs 신한지주
  ['068270', '207940'],   // 셀트리온 vs 삼성바이오
  ['005490', '064350'],   // POSCO홀딩스 vs 현대로템
  ['030200', '017670'],   // KT vs SKT
  ['012450', '064350'],   // 한화에어로 vs 현대로템
  ['028260', '032830'],   // 삼성물산 vs 삼성생명
];

const TOTAL_PAIRS = APT_PAIRS.length + STOCK_PAIRS.length; // 28

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function formatPrice(val: number): string {
  if (!val) return '-';
  if (val >= 10000) {
    const eok = Math.floor(val / 10000);
    const remainder = val % 10000;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${val.toLocaleString()}만원`;
}

function formatMarketCap(val: number | null): string {
  if (!val) return '-';
  if (val >= 1_000_000_000_000) {
    return `${(val / 1_000_000_000_000).toFixed(1)}조원`;
  }
  if (val >= 100_000_000) {
    return `${(val / 100_000_000).toFixed(0)}억원`;
  }
  return `${val.toLocaleString()}원`;
}

function formatVolume(val: number | null): string {
  if (!val) return '-';
  if (val >= 10000) return `${(val / 10000).toFixed(1)}만주`;
  return `${val.toLocaleString()}주`;
}

function pctStr(val: number | null): string {
  if (val == null) return '-';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function slugify(s: string): string {
  return s
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9가-힣\-]/g, '')
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/*  apt comparison content builder                                     */
/* ------------------------------------------------------------------ */

interface AptSideStats {
  sigungu: string;
  siteCount: number;
  avgPriceMin: number;
  avgPriceMax: number;
  txCount: number;
  avgDealAmount: number;
  maxDealAmount: number;
  avgArea: number;
}

function buildAptContent(a: AptSideStats, b: AptSideStats): string {
  const parts: string[] = [];

  parts.push(`## ${a.sigungu} vs ${b.sigungu} 아파트 비교 2026`);
  parts.push('');
  parts.push(`${a.sigungu}와(과) ${b.sigungu}, 두 지역의 아파트 시세와 거래 현황을 데이터 기반으로 비교 분석합니다. 단지 수, 평균 시세, 거래량, 최고가, 평균 면적 등 핵심 지표를 한눈에 비교해 보세요.`);
  parts.push('');

  // VS banner
  parts.push('### VS 배너');
  parts.push('');
  parts.push(`**${a.sigungu}** VS **${b.sigungu}**`);
  parts.push('');

  // Comparison table
  parts.push('### 비교 요약');
  parts.push('');
  parts.push(`| 항목 | ${a.sigungu} | ${b.sigungu} |`);
  parts.push('|---|---|---|');
  parts.push(`| 단지 수 | ${a.siteCount.toLocaleString()}개 | ${b.siteCount.toLocaleString()}개 |`);
  parts.push(`| 평균 시세 | ${formatPrice(a.avgPriceMin)}~${formatPrice(a.avgPriceMax)} | ${formatPrice(b.avgPriceMin)}~${formatPrice(b.avgPriceMax)} |`);
  parts.push(`| 거래 건수 | ${a.txCount.toLocaleString()}건 | ${b.txCount.toLocaleString()}건 |`);
  parts.push(`| 최고가 | ${formatPrice(a.maxDealAmount)} | ${formatPrice(b.maxDealAmount)} |`);
  parts.push(`| 평균 면적 | ${a.avgArea ? a.avgArea.toFixed(1) + 'm²' : '-'} | ${b.avgArea ? b.avgArea.toFixed(1) + 'm²' : '-'} |`);
  parts.push('');

  // Detailed analysis
  parts.push('### 상세 분석');
  parts.push('');

  const aAvg = a.avgDealAmount;
  const bAvg = b.avgDealAmount;

  if (aAvg && bAvg) {
    const higher = aAvg > bAvg ? a.sigungu : b.sigungu;
    const lower = aAvg > bAvg ? b.sigungu : a.sigungu;
    const diff = Math.abs(aAvg - bAvg);
    parts.push(`평균 거래가 기준으로 **${higher}**가 **${lower}**보다 약 ${formatPrice(diff)} 높은 수준입니다. `);
  }

  if (a.siteCount && b.siteCount) {
    const moreSupply = a.siteCount > b.siteCount ? a.sigungu : b.sigungu;
    parts.push(`단지 수는 **${moreSupply}**가 더 많아 공급 규모가 큰 편입니다. `);
  }

  if (a.txCount && b.txCount) {
    const moreTx = a.txCount > b.txCount ? a.sigungu : b.sigungu;
    parts.push(`최근 거래 건수 기준으로는 **${moreTx}**의 거래가 더 활발합니다.`);
  }
  parts.push('');

  parts.push(`두 지역 모두 실수요와 투자 수요가 꾸준한 곳입니다. 교통, 학군, 생활 인프라 등을 종합적으로 비교하여 본인의 상황에 맞는 지역을 선택하시기 바랍니다. 금리 변동과 정부 정책에 따라 시세가 달라질 수 있으므로 최신 실거래가를 반드시 확인하세요.`);
  parts.push('');

  parts.push(`${a.sigungu}는 ${a.siteCount > 50 ? '풍부한 단지 수와 다양한 평형대를 갖추고 있어 선택의 폭이 넓습니다.' : '비교적 컴팩트한 시장이지만 핵심 입지의 우수한 단지들이 분포해 있습니다.'} ${b.sigungu}는 ${b.siteCount > 50 ? '대규모 주거 단지가 밀집한 지역으로 생활 인프라가 잘 갖춰져 있습니다.' : '최근 개발 및 정비 사업으로 주목받고 있는 지역입니다.'}`);
  parts.push('');

  parts.push('부동산 투자는 장기적인 시각에서 접근해야 하며, 전세가율, 입주 물량, 재개발·재건축 이슈 등도 함께 고려하시기 바랍니다.');
  parts.push('');

  // Internal links
  parts.push('### 관련 정보');
  parts.push('');
  parts.push(`- [아파트 정보 보기 →](${SITE_URL}/apt)`);
  parts.push(`- [청약 정보 보기 →](${SITE_URL}/apt/subscriptions)`);
  parts.push('');

  parts.push('---');
  parts.push('');
  parts.push('> **면책고지**: 본 콘텐츠는 공공 데이터를 기반으로 정보 제공 목적으로 작성되었으며, 특정 부동산의 매수·매도를 권유하지 않습니다. 시세 정보는 작성 시점 기준이며 실제와 다를 수 있습니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.');

  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/*  stock comparison content builder                                   */
/* ------------------------------------------------------------------ */

interface StockInfo {
  symbol: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  volume: number | null;
  sector: string | null;
  market: string;
}

function buildStockContent(a: StockInfo, b: StockInfo): string {
  const parts: string[] = [];

  parts.push(`## ${a.name} vs ${b.name} 주식 비교 2026`);
  parts.push('');
  parts.push(`${a.name}(${a.symbol})과(와) ${b.name}(${b.symbol}), 두 종목의 현재가, 시가총액, 등락률, 섹터, 거래량 등 핵심 투자 지표를 비교 분석합니다.`);
  parts.push('');

  // VS banner
  parts.push('### VS 배너');
  parts.push('');
  parts.push(`**${a.name}** VS **${b.name}**`);
  parts.push('');

  // Comparison table
  parts.push('### 비교 요약');
  parts.push('');
  parts.push(`| 항목 | ${a.name} | ${b.name} |`);
  parts.push('|---|---|---|');
  parts.push(`| 현재가 | ${a.price ? a.price.toLocaleString() + '원' : '-'} | ${b.price ? b.price.toLocaleString() + '원' : '-'} |`);
  parts.push(`| 시가총액 | ${formatMarketCap(a.market_cap)} | ${formatMarketCap(b.market_cap)} |`);
  parts.push(`| 등락률 | ${pctStr(a.change_pct)} | ${pctStr(b.change_pct)} |`);
  parts.push(`| 섹터 | ${a.sector || '-'} | ${b.sector || '-'} |`);
  parts.push(`| 거래량 | ${formatVolume(a.volume)} | ${formatVolume(b.volume)} |`);
  parts.push('');

  // Investment points
  parts.push('### 투자 포인트');
  parts.push('');

  if (a.market_cap && b.market_cap) {
    const bigger = a.market_cap > b.market_cap ? a : b;
    const smaller = a.market_cap > b.market_cap ? b : a;
    parts.push(`시가총액 기준으로 **${bigger.name}**(${formatMarketCap(bigger.market_cap)})이(가) **${smaller.name}**(${formatMarketCap(smaller.market_cap)})보다 큰 규모입니다. `);
  }

  if (a.change_pct != null && b.change_pct != null) {
    const better = a.change_pct > b.change_pct ? a : b;
    parts.push(`최근 등락률 기준으로는 **${better.name}**(${pctStr(better.change_pct)})이(가) 상대적으로 강세를 보이고 있습니다.`);
  }
  parts.push('');

  const sameSector = a.sector && b.sector && a.sector === b.sector;
  if (sameSector) {
    parts.push(`두 종목 모두 **${a.sector}** 섹터에 속하며, 같은 업종 내에서 시장 점유율과 실적 성장성을 비교하는 것이 핵심입니다. 업종 전체의 매크로 환경(수요·공급, 정책, 환율 등)이 두 종목 모두에 유사한 영향을 미칩니다.`);
  } else {
    parts.push(`${a.name}은(는) ${a.sector || '해당'} 섹터, ${b.name}은(는) ${b.sector || '해당'} 섹터에 속합니다. 섹터가 다른 만큼 영향을 받는 매크로 변수도 다르므로 분산 투자 관점에서 양쪽을 포트폴리오에 편입하는 전략도 고려할 수 있습니다.`);
  }
  parts.push('');

  parts.push(`투자 결정 시에는 PER, PBR, ROE 등 재무 지표를 함께 확인하시고, 외국인·기관 수급 동향도 참고하시기 바랍니다. 개별 종목의 실적 발표 일정과 업종 이슈도 주가에 큰 영향을 미치는 요소입니다.`);
  parts.push('');

  parts.push(`주식 투자는 원금 손실의 위험이 있으며, 과거 수익률이 미래 수익을 보장하지 않습니다. 레버리지 과다 사용을 피하고, 분산 투자 원칙을 지키시기 바랍니다.`);
  parts.push('');

  // Internal links
  parts.push('### 관련 정보');
  parts.push('');
  parts.push(`- [${a.name} 종목 상세 →](${SITE_URL}/stock/${a.symbol})`);
  parts.push(`- [${b.name} 종목 상세 →](${SITE_URL}/stock/${b.symbol})`);
  parts.push('');

  parts.push('---');
  parts.push('');
  parts.push('> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 특정 종목의 매수·매도를 권유하지 않습니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.');

  return parts.join('\n');
}

/* ------------------------------------------------------------------ */
/*  main handler                                                       */
/* ------------------------------------------------------------------ */

export const GET = withCronAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const offset = parseInt(params.get('offset') || '0', 10);
  const limit = parseInt(params.get('limit') || String(TOTAL_PAIRS), 10);

  const admin = getSupabaseAdmin();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let created = 0;
  let skipped = 0;
  let idx = 0; // global pair index

  /* ==================== APT PAIRS ==================== */

  for (const [regionA, sigunguA, regionB, sigunguB] of APT_PAIRS) {
    if (idx >= offset + limit) break;
    if (idx < offset) { idx++; continue; }
    idx++;

    const slug = `compare-apt-${slugify(sigunguA)}-vs-${slugify(sigunguB)}-${monthKey}`;

    try {
      // --- Side A ---
      const [sitesA, txA] = await Promise.all([
        admin
          .from('apt_sites')
          .select('id, price_min, price_max')
          .eq('region', regionA)
          .ilike('sigungu', `%${sigunguA}%`),
        admin
          .from('apt_transactions')
          .select('deal_amount, exclusive_area')
          .eq('region_nm', regionA)
          .ilike('sigungu', `%${sigunguA}%`)
          .order('deal_date', { ascending: false })
          .limit(500),
      ]);

      // --- Side B ---
      const [sitesB, txB] = await Promise.all([
        admin
          .from('apt_sites')
          .select('id, price_min, price_max')
          .eq('region', regionB)
          .ilike('sigungu', `%${sigunguB}%`),
        admin
          .from('apt_transactions')
          .select('deal_amount, exclusive_area')
          .eq('region_nm', regionB)
          .ilike('sigungu', `%${sigunguB}%`)
          .order('deal_date', { ascending: false })
          .limit(500),
      ]);

      const sA = sitesA.data || [];
      const sB = sitesB.data || [];
      const tA = (txA.data || []).filter((t: any) => t.deal_amount && t.deal_amount > 0);
      const tB = (txB.data || []).filter((t: any) => t.deal_amount && t.deal_amount > 0);

      // Skip pair if either side has no data at all
      if (sA.length === 0 && tA.length === 0) {
        console.log(`[blog-comparison] No data for ${sigunguA}, skipping pair`);
        skipped++;
        continue;
      }
      if (sB.length === 0 && tB.length === 0) {
        console.log(`[blog-comparison] No data for ${sigunguB}, skipping pair`);
        skipped++;
        continue;
      }

      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

      const statsA: AptSideStats = {
        sigungu: sigunguA,
        siteCount: sA.length,
        avgPriceMin: avg(sA.filter((s: any) => s.price_min).map((s: any) => s.price_min)),
        avgPriceMax: avg(sA.filter((s: any) => s.price_max).map((s: any) => s.price_max)),
        txCount: tA.length,
        avgDealAmount: avg(tA.map((t: any) => t.deal_amount)),
        maxDealAmount: tA.length > 0 ? Math.max(...tA.map((t: any) => t.deal_amount)) : 0,
        avgArea: avg(tA.filter((t: any) => t.exclusive_area).map((t: any) => t.exclusive_area)),
      };

      const statsB: AptSideStats = {
        sigungu: sigunguB,
        siteCount: sB.length,
        avgPriceMin: avg(sB.filter((s: any) => s.price_min).map((s: any) => s.price_min)),
        avgPriceMax: avg(sB.filter((s: any) => s.price_max).map((s: any) => s.price_max)),
        txCount: tB.length,
        avgDealAmount: avg(tB.map((t: any) => t.deal_amount)),
        maxDealAmount: tB.length > 0 ? Math.max(...tB.map((t: any) => t.deal_amount)) : 0,
        avgArea: avg(tB.filter((t: any) => t.exclusive_area).map((t: any) => t.exclusive_area)),
      };

      const title = `${sigunguA} vs ${sigunguB} 비교 2026 — 시세·학군·교통 완전 분석`;
      const content = buildAptContent(statsA, statsB);
      const tags = [regionA, sigunguA, regionB !== regionA ? regionB : '', sigunguB, '아파트', '비교', monthKey].filter(Boolean);

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content: ensureMinLength(content, 'apt', 1500),
        excerpt: `${sigunguA} vs ${sigunguB} 아파트 시세·거래량·학군·교통 비교 분석 2026`,
        category: 'apt',
        tags,
        source_type: 'auto',
        cron_type: 'blog-comparison',
        data_date: monthKey,
        source_ref: 'apt_sites,apt_transactions',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
        image_alt: generateImageAlt('apt', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
        console.log(`[blog-comparison] Created: ${slug}`);
      } else {
        skipped++;
        console.log(`[blog-comparison] Skipped ${slug}: ${result.reason}`);
      }
    } catch (err: any) {
      console.error(`[blog-comparison] Error for ${slug}:`, err.message);
      skipped++;
    }
  }

  /* ==================== STOCK PAIRS ==================== */

  for (const [symbolA, symbolB] of STOCK_PAIRS) {
    if (idx >= offset + limit) break;
    if (idx < offset) { idx++; continue; }
    idx++;

    const slug = `compare-stock-${symbolA}-vs-${symbolB}-${monthKey}`;

    try {
      const [resA, resB] = await Promise.all([
        admin
          .from('stock_quotes')
          .select('symbol, name, price, change_pct, market_cap, volume, sector, market')
          .eq('symbol', symbolA)
          .single(),
        admin
          .from('stock_quotes')
          .select('symbol, name, price, change_pct, market_cap, volume, sector, market')
          .eq('symbol', symbolB)
          .single(),
      ]);

      if (!resA.data || !resB.data) {
        console.log(`[blog-comparison] No stock data for ${symbolA} or ${symbolB}, skipping`);
        skipped++;
        continue;
      }

      const a: StockInfo = resA.data as StockInfo;
      const b: StockInfo = resB.data as StockInfo;

      const title = `${a.name} vs ${b.name} 비교 2026 — 시세·시총·섹터 완전 분석`;
      const content = buildStockContent(a, b);
      const tags = [a.name, b.name, a.sector, b.sector, '주식', '비교', monthKey].filter(Boolean) as string[];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content: ensureMinLength(content, 'stock', 1500),
        excerpt: `${a.name} vs ${b.name} 주식 시세·시총·등락률·섹터 비교 분석 2026`,
        category: 'stock',
        tags,
        source_type: 'auto',
        cron_type: 'blog-comparison',
        data_date: monthKey,
        source_ref: 'stock_quotes',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
        image_alt: generateImageAlt('stock', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('stock', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
        console.log(`[blog-comparison] Created: ${slug}`);
      } else {
        skipped++;
        console.log(`[blog-comparison] Skipped ${slug}: ${result.reason}`);
      }
    } catch (err: any) {
      console.error(`[blog-comparison] Error for ${slug}:`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: TOTAL_PAIRS,
    offset,
    limit,
    month: monthKey,
  });
});
