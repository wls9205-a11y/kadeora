export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

const REGION_SLUG_MAP: Record<string, string> = {
  서울: 'seoul', 부산: 'busan', 대구: 'daegu', 인천: 'incheon',
  광주: 'gwangju', 대전: 'daejeon', 울산: 'ulsan', 세종: 'sejong',
  경기: 'gyeonggi', 강원: 'gangwon', 충북: 'chungbuk', 충남: 'chungnam',
  전북: 'jeonbuk', 전남: 'jeonnam', 경북: 'gyeongbuk', 경남: 'gyeongnam',
  제주: 'jeju',
};

interface TradeStat {
  id: string;
  stat_month: string;
  region: string;
  avg_price: number | null;
  max_price: number | null;
  min_price: number | null;
  trade_count: number | null;
  avg_area: number | null;
  avg_price_per_pyeong: number | null;
}

interface Transaction {
  id: string;
  apt_name: string;
  region_nm: string;
  sigungu: string;
  dong: string;
  exclusive_area: number;
  deal_amount: number;
  deal_date: string;
  floor: number;
  built_year: number;
}

function formatPrice(val: number): string {
  if (!val) return '-';
  if (val >= 10000) {
    const eok = Math.floor(val / 10000);
    const remainder = val % 10000;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${val.toLocaleString()}만원`;
}

function formatPricePerPyeong(val: number): string {
  if (!val) return '-';
  if (val >= 10000) {
    const eok = Math.floor(val / 10000);
    const remainder = Math.round((val % 10000) / 100) * 100;
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원/평` : `${eok}억원/평`;
  }
  return `${val.toLocaleString()}만원/평`;
}

function areaToPyeong(m2: number): string {
  return (m2 / 3.3058).toFixed(1);
}

function getLatestMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTitleMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

function buildContent(
  region: string,
  stat: TradeStat,
  subRegionStats: TradeStat[],
  top5: Transaction[],
  titleMonth: string,
): string {
  const parts: string[] = [];

  // Header
  parts.push(`# ${region} 아파트 실거래가 동향 ${titleMonth}`);
  parts.push('');
  parts.push(`${region} 지역의 ${titleMonth} 아파트 매매 실거래 데이터를 분석했습니다. 국토교통부 실거래가 신고 자료를 기반으로 거래건수, 평균 매매가, 평당가격, 최고 거래가 등 핵심 지표를 정리합니다.`);
  parts.push('');

  // KPI 4 cards
  parts.push('## 핵심 지표 요약');
  parts.push('');
  parts.push(`| 지표 | 수치 |`);
  parts.push(`|------|------|`);
  parts.push(`| 📊 거래건수 | **${(stat.trade_count ?? 0).toLocaleString()}건** |`);
  parts.push(`| 💰 평균 매매가 | **${formatPrice(stat.avg_price ?? 0)}** |`);
  parts.push(`| 📐 평당가격 | **${formatPricePerPyeong(stat.avg_price_per_pyeong ?? 0)}** |`);
  parts.push(`| 🏆 최고 거래가 | **${formatPrice(stat.max_price ?? 0)}** |`);
  parts.push('');

  parts.push(`${region}의 이번 달 아파트 거래는 총 **${(stat.trade_count ?? 0).toLocaleString()}건**이 신고되었습니다. 평균 매매가는 ${formatPrice(stat.avg_price ?? 0)}이며, 평당 평균 가격은 ${formatPricePerPyeong(stat.avg_price_per_pyeong ?? 0)} 수준입니다. 최저 거래가는 ${formatPrice(stat.min_price ?? 0)}, 최고 거래가는 ${formatPrice(stat.max_price ?? 0)}으로 단지별·면적별 편차가 있습니다.`);
  parts.push('');

  // Sub-region table
  if (subRegionStats.length > 0) {
    parts.push('## 시군구별 거래 현황');
    parts.push('');
    parts.push(`${region} 내 시군구별 아파트 거래 현황을 표로 정리했습니다.`);
    parts.push('');
    parts.push('| 시군구 | 거래건수 | 평균 매매가 | 평당가격 | 최고가 |');
    parts.push('|--------|----------|------------|----------|--------|');
    const sorted = [...subRegionStats].sort((a, b) => (b.trade_count ?? 0) - (a.trade_count ?? 0));
    for (const s of sorted) {
      const subName = s.region.replace(region, '').trim() || s.region;
      parts.push(`| ${subName} | ${(s.trade_count ?? 0).toLocaleString()}건 | ${formatPrice(s.avg_price ?? 0)} | ${formatPricePerPyeong(s.avg_price_per_pyeong ?? 0)} | ${formatPrice(s.max_price ?? 0)} |`);
    }
    parts.push('');

    if (sorted.length >= 2) {
      const topArea = sorted[0];
      const topAreaName = topArea.region.replace(region, '').trim() || topArea.region;
      parts.push(`거래가 가장 활발한 지역은 **${topAreaName}**으로 ${(topArea.trade_count ?? 0).toLocaleString()}건이 거래되었고, 평균 매매가 ${formatPrice(topArea.avg_price ?? 0)} 수준입니다.`);
      parts.push('');
    }
  }

  // TOP5 신고가 ranking
  if (top5.length > 0) {
    parts.push('## 신고가 TOP 5 거래');
    parts.push('');
    parts.push(`${titleMonth} ${region}에서 가장 높은 금액으로 거래된 아파트 TOP 5입니다.`);
    parts.push('');
    parts.push('| 순위 | 아파트 | 소재지 | 전용면적 | 거래금액 | 층 | 거래일 |');
    parts.push('|------|--------|--------|----------|----------|-----|--------|');
    top5.forEach((tx, idx) => {
      const pyeong = areaToPyeong(tx.exclusive_area);
      parts.push(`| ${idx + 1} | ${tx.apt_name} | ${tx.sigungu} ${tx.dong} | ${tx.exclusive_area}m² (${pyeong}평) | **${formatPrice(tx.deal_amount)}** | ${tx.floor}층 | ${tx.deal_date} |`);
    });
    parts.push('');

    if (top5[0]) {
      const top = top5[0];
      const topPyeong = areaToPyeong(top.exclusive_area);
      parts.push(`이번 달 ${region} 최고가 거래는 **${top.apt_name}**(${top.sigungu} ${top.dong})으로, 전용 ${top.exclusive_area}m²(${topPyeong}평)가 ${formatPrice(top.deal_amount)}에 ${top.floor}층에서 거래되었습니다.${top.built_year ? ` ${top.built_year}년에 준공된 단지입니다.` : ''}`);
      parts.push('');
    }
  }

  // Analysis
  parts.push('## 시장 분석');
  parts.push('');

  const avgP = stat.avg_price ?? 0;
  const avgPriceEok = avgP >= 10000 ? `${(avgP / 10000).toFixed(1)}억원` : formatPrice(avgP);
  parts.push(`${region} 아파트 시장은 ${titleMonth} 기준 총 ${(stat.trade_count ?? 0).toLocaleString()}건의 거래가 이루어졌습니다. 평균 거래 면적은 ${stat.avg_area ? stat.avg_area.toFixed(1) + 'm²(' + areaToPyeong(stat.avg_area) + '평)' : '확인 중'}이며, 평균 매매가는 ${avgPriceEok} 수준입니다.`);
  parts.push('');

  if (stat.max_price && stat.min_price) {
    const gap = (stat.max_price ?? 0) - (stat.min_price ?? 0);
    parts.push(`최고가(${formatPrice(stat.max_price ?? 0)})와 최저가(${formatPrice(stat.min_price ?? 0)})의 차이는 ${formatPrice(gap)}으로, 지역 내 단지별 가격 격차가 뚜렷합니다. 신축 대단지와 구축 소규모 단지 간 양극화 현상이 지속되고 있으며, 입지와 브랜드에 따른 가격 차별화가 심화되는 추세입니다.`);
    parts.push('');
  }

  parts.push('실수요자 입장에서는 금리 변동과 대출 규제를 감안하여 매수 타이밍을 검토할 필요가 있습니다. 투자 목적이라면 전세가율, 입주 물량, 지역 개발 호재 등을 종합적으로 분석하시기 바랍니다.');
  parts.push('');

  // Internal links
  parts.push('## 더 알아보기');
  parts.push('');
  parts.push(`- [전국 아파트 실거래가 조회](${SITE_URL}/apt) — 단지별 실거래 내역을 직접 검색해 보세요.`);
  parts.push(`- [아파트 시장 분석 블로그](${SITE_URL}/blog?category=apt) — 매월 업데이트되는 부동산 시장 분석을 확인하세요.`);
  parts.push(`- [청약 일정 확인](${SITE_URL}/subscription) — 관심 지역의 청약 일정을 놓치지 마세요.`);
  parts.push('');

  // SEO footer
  parts.push('---');
  parts.push('');
  parts.push(`> **면책고지**: 본 콘텐츠는 국토교통부 실거래가 공개시스템 데이터를 기반으로 정보 제공 목적으로 작성되었으며, 특정 부동산의 매수·매도를 권유하지 않습니다. 실거래 신고 데이터는 신고 취소·정정이 발생할 수 있으므로, 최종 데이터는 [국토교통부 실거래가 공개시스템](https://rt.molit.go.kr)에서 직접 확인하시기 바랍니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`);

  return parts.join('\n');
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const offset = parseInt(params.get('offset') || '0', 10);
  const limit = parseInt(params.get('limit') || '1', 10);
  const targetRegions = REGIONS.slice(offset, offset + limit);

  const admin = getSupabaseAdmin();
  const statMonth = getLatestMonth();
  const titleMonth = getTitleMonth();

  // 1. Fetch all stats for the latest month
  const { data: allStats, error: statsErr } = await admin
    .from('apt_trade_monthly_stats')
    .select('id, stat_month, region, avg_price, max_price, min_price, trade_count, avg_area, avg_price_per_pyeong')
    .eq('stat_month', statMonth);

  if (statsErr) {
    console.error('[blog-trade-trend] stats fetch error:', statsErr.message);
    return NextResponse.json({ ok: false, error: statsErr.message });
  }

  if (!allStats || allStats.length === 0) {
    // Try previous month if current month has no data yet
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    const { data: prevStats } = await admin
      .from('apt_trade_monthly_stats')
      .select('id, stat_month, region, avg_price, max_price, min_price, trade_count, avg_area, avg_price_per_pyeong')
      .eq('stat_month', prevMonth);

    if (!prevStats || prevStats.length === 0) {
      return NextResponse.json({ ok: true, created: 0, skipped: targetRegions.length, total: REGIONS.length, reason: 'no_data' });
    }

    // Use prev month data — reassign
    return await processRegions(admin, prevStats, targetRegions, prevMonth, titleMonth);
  }

  return await processRegions(admin, allStats, targetRegions, statMonth, titleMonth);
});

async function processRegions(
  admin: ReturnType<typeof getSupabaseAdmin>,
  allStats: TradeStat[],
  targetRegions: readonly string[],
  statMonth: string,
  titleMonth: string,
) {
  let created = 0;
  let skipped = 0;

  for (const region of targetRegions) {
    try {
      const slugRegion = REGION_SLUG_MAP[region] || region;
      const slug = `apt-trade-trend-${slugRegion}-${statMonth}`;

      // Check for exact-match region stat (시도 level)
      const regionStat = allStats.find(
        (s) => s.region === region || s.region.startsWith(region),
      );

      if (!regionStat) {
        skipped++;
        continue;
      }

      // Aggregate stats: the regionStat itself is the 시도 summary,
      // sub-region stats are entries where region contains the 시도 name but is longer (시군구)
      const subRegionStats = allStats.filter(
        (s) => s.region !== region && s.region.startsWith(region),
      );

      // Build an aggregate stat if regionStat is not a direct match
      let aggregatedStat: TradeStat;
      if (regionStat.region === region) {
        aggregatedStat = regionStat;
      } else {
        // No exact 시도-level row — aggregate from sub-regions
        const regionRows = allStats.filter((s) => s.region.startsWith(region));
        const totalCount = regionRows.reduce((sum, r) => sum + (r.trade_count || 0), 0);
        const weightedAvg = totalCount > 0
          ? Math.round(regionRows.reduce((sum, r) => sum + (r.avg_price || 0) * (r.trade_count || 0), 0) / totalCount)
          : 0;
        const weightedPyeong = totalCount > 0
          ? Math.round(regionRows.reduce((sum, r) => sum + (r.avg_price_per_pyeong || 0) * (r.trade_count || 0), 0) / totalCount)
          : 0;
        const weightedArea = totalCount > 0
          ? regionRows.reduce((sum, r) => sum + (r.avg_area || 0) * (r.trade_count || 0), 0) / totalCount
          : 0;

        const minPriceRows = regionRows.filter((r) => (r.min_price ?? 0) > 0).map((r) => r.min_price ?? 0);
        aggregatedStat = {
          id: '',
          stat_month: statMonth,
          region,
          avg_price: weightedAvg,
          max_price: Math.max(...regionRows.map((r) => r.max_price ?? 0)),
          min_price: minPriceRows.length > 0 ? Math.min(...minPriceRows) : 0,
          trade_count: totalCount,
          avg_area: weightedArea,
          avg_price_per_pyeong: weightedPyeong,
        };
      }

      if ((aggregatedStat.trade_count ?? 0) === 0) {
        skipped++;
        continue;
      }

      // 2. Fetch TOP5 신고가 transactions for this region
      const { data: topTx } = await admin
        .from('apt_transactions')
        .select('id, apt_name, region_nm, sigungu, dong, exclusive_area, deal_amount, deal_date, floor, built_year')
        .like('region_nm', `${region}%`)
        .gte('deal_date', `${statMonth}-01`)
        .lte('deal_date', `${statMonth}-31`)
        .order('deal_amount', { ascending: false })
        .limit(5);

      const top5 = (topTx || []) as Transaction[];

      // 3. Build the blog content
      const title = `${region} 아파트 실거래가 동향 ${titleMonth} — 평당가 추이와 거래량 분석`;
      let content = buildContent(region, aggregatedStat, subRegionStats, top5, titleMonth);
      // quality gate: skip if content too short

      const tags = [region, '아파트', '실거래가', '부동산', statMonth, '평당가', '거래량'];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content,
        excerpt: `${titleMonth} ${region} 아파트 매매 실거래 동향 — 거래건수 ${(aggregatedStat.trade_count ?? 0).toLocaleString()}건, 평균가 ${formatPrice(aggregatedStat.avg_price ?? 0)}, 평당 ${formatPricePerPyeong(aggregatedStat.avg_price_per_pyeong ?? 0)}`,
        category: 'apt',
        tags,
        source_type: 'auto',
        cron_type: 'blog-trade-trend',
        data_date: statMonth,
        source_ref: 'apt_trade_monthly_stats',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=apt&author=${encodeURIComponent('카더라')}&design=2`,
        image_alt: generateImageAlt('apt', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
      } else {
        if (result.reason === 'duplicate_slug' || result.reason === 'similar_title') {
          skipped++;
        } else {
          console.warn(`[blog-trade-trend] Failed ${slug}: ${result.reason}`);
          skipped++;
        }
      }
    } catch (err: any) {
      console.error(`[blog-trade-trend] Error for ${region}:`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: REGIONS.length,
    stat_month: allStats[0]?.stat_month,
  });
}
