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
/*  Helper: format price (만원 → 억/만원)                              */
/* ------------------------------------------------------------------ */
function formatPrice(val: number): string {
  if (!val) return '-';
  if (val >= 10000) {
    const eok = Math.floor(val / 10000);
    const remainder = val % 10000;
    return remainder > 0
      ? `${eok}억 ${remainder.toLocaleString()}만원`
      : `${eok}억원`;
  }
  return `${val.toLocaleString()}만원`;
}

/* ------------------------------------------------------------------ */
/*  Helper: slug-safe string (Korean OK, spaces→dashes, trim specials) */
/* ------------------------------------------------------------------ */
function toSlugPart(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^가-힣a-zA-Z0-9\-]/g, '');
}

/* ------------------------------------------------------------------ */
/*  Helper: current year-month string for date range filters          */
/* ------------------------------------------------------------------ */
function getThreeMonthsAgoDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Content builder                                                    */
/* ------------------------------------------------------------------ */
interface AptSite {
  name: string;
  address: string | null;
  total_units: number | null;
  built_year: number | null;
  price_min: number | null;
  price_max: number | null;
  nearby_station: string | null;
  school_district: string | null;
}

interface RecentTx {
  apt_name: string;
  exclusive_area: number | null;
  deal_amount: number | null;
  floor: number | null;
  deal_date: string | null;
}

function buildContent(
  region: string,
  sigungu: string,
  siteCount: number,
  top10: AptSite[],
  recentTx: RecentTx[],
): string {
  const parts: string[] = [];

  // --- Header ---
  parts.push(`## ${region} ${sigungu} 아파트 추천 2026`);
  parts.push('');
  parts.push(
    `${sigungu}는 ${region}의 주요 주거지역으로, 다양한 아파트 단지가 밀집해 있어 실거주와 투자 양면에서 꾸준한 관심을 받고 있습니다. 이 글에서는 ${sigungu} 내 등록된 ${siteCount}개 단지 중 시세 상위 10곳을 중심으로 학군, 교통, 최근 실거래 현황을 종합 분석합니다.`,
  );
  parts.push('');

  // --- Price summary table ---
  const validPriceMax = top10.filter((a) => a.price_max && a.price_max > 0);
  const validPriceMin = top10.filter((a) => a.price_min && a.price_min > 0);
  const maxPriceMax = validPriceMax.length > 0
    ? Math.max(...validPriceMax.map((a) => a.price_max!))
    : 0;
  const minPriceMin = validPriceMin.length > 0
    ? Math.min(...validPriceMin.map((a) => a.price_min!))
    : 0;
  const avgPrice =
    validPriceMax.length > 0
      ? Math.round(
          validPriceMax.reduce((s, a) => s + a.price_max!, 0) /
            validPriceMax.length,
        )
      : 0;

  parts.push(`### 📊 ${sigungu} 아파트 시세 요약`);
  parts.push('');
  parts.push('| 항목 | 내용 |');
  parts.push('|---|---|');
  parts.push(`| 등록 단지 수 | ${siteCount}개 |`);
  parts.push(
    `| 최고 시세 | ${maxPriceMax ? formatPrice(maxPriceMax) : '정보 없음'} |`,
  );
  parts.push(
    `| 최저 시세 | ${minPriceMin ? formatPrice(minPriceMin) : '정보 없음'} |`,
  );
  parts.push(
    `| 평균 시세 | ${avgPrice ? formatPrice(avgPrice) : '정보 없음'} |`,
  );
  parts.push('');

  if (maxPriceMax && minPriceMin) {
    parts.push(
      `${sigungu} 아파트 시세는 최저 ${formatPrice(minPriceMin)}에서 최고 ${formatPrice(maxPriceMax)}까지 분포하며, 상위 10개 단지 기준 평균 ${formatPrice(avgPrice)} 수준입니다. 단지 규모, 연식, 입지에 따라 가격 편차가 크므로 개별 단지 분석이 중요합니다.`,
    );
    parts.push('');
  }

  // --- TOP 10 table ---
  parts.push(`### 🏆 시세 TOP 10 단지`);
  parts.push('');
  parts.push('| 순위 | 단지명 | 주소 | 세대수 | 준공 | 시세(만원) |');
  parts.push('|---|---|---|---|---|---|');
  top10.forEach((apt, idx) => {
    const priceRange =
      apt.price_min && apt.price_max
        ? `${apt.price_min.toLocaleString()}~${apt.price_max.toLocaleString()}`
        : apt.price_max
          ? apt.price_max.toLocaleString()
          : '-';
    parts.push(
      `| ${idx + 1} | ${apt.name} | ${apt.address || '-'} | ${apt.total_units?.toLocaleString() || '-'} | ${apt.built_year || '-'} | ${priceRange} |`,
    );
  });
  parts.push('');

  if (top10[0]) {
    const top = top10[0];
    parts.push(
      `시세 1위는 **${top.name}**으로${top.built_year ? ` ${top.built_year}년 준공` : ''}${top.total_units ? `, ${top.total_units.toLocaleString()}세대 규모` : ''}입니다.${top.price_max ? ` 최고 시세 ${formatPrice(top.price_max)} 수준으로 ${sigungu} 내 대장 아파트 역할을 하고 있습니다.` : ''}`,
    );
    parts.push('');
  }

  // --- School district info ---
  const schools = [
    ...new Set(
      top10
        .map((a) => a.school_district)
        .filter((s): s is string => !!s && s.trim() !== ''),
    ),
  ];
  parts.push(`### 🎓 학군 정보`);
  parts.push('');
  if (schools.length > 0) {
    parts.push(
      `${sigungu} 주요 단지의 학군 현황입니다. 학군은 아파트 가치에 장기적으로 큰 영향을 미치는 핵심 요소입니다.`,
    );
    parts.push('');
    parts.push(schools.map((s) => `\`${s}\``).join(' · '));
    parts.push('');
    parts.push(
      `총 ${schools.length}개 학군이 확인되며, 자녀 교육을 고려하시는 분은 학교알리미(schoolinfo.go.kr)에서 배정 학교와 학업 성취도를 비교해 보시기 바랍니다.`,
    );
  } else {
    parts.push(
      `현재 등록된 학군 정보가 제한적입니다. 학교알리미(schoolinfo.go.kr)에서 ${sigungu} 내 학교 배정 현황을 직접 확인하시기 바랍니다.`,
    );
  }
  parts.push('');

  // --- Transportation info ---
  const stations = [
    ...new Set(
      top10
        .map((a) => a.nearby_station)
        .filter((s): s is string => !!s && s.trim() !== ''),
    ),
  ];
  parts.push(`### 🚇 교통 정보`);
  parts.push('');
  if (stations.length > 0) {
    parts.push(
      `${sigungu} 주요 단지 인근 교통 거점입니다.`,
    );
    parts.push('');
    parts.push(stations.map((s) => `\`${s}\``).join(' · '));
    parts.push('');
    parts.push(
      `교통 접근성은 출퇴근 편의와 자산 가치 모두에 영향을 미칩니다. 역세권 단지는 비역세권 대비 시세 프리미엄이 형성되는 경향이 있습니다.`,
    );
  } else {
    parts.push(
      `교통 정보는 네이버맵 또는 카카오맵에서 ${sigungu} 내 대중교통 노선을 직접 확인하시기 바랍니다.`,
    );
  }
  parts.push('');

  // --- Recent transactions ---
  parts.push(`### 💰 최근 실거래`);
  parts.push('');
  if (recentTx.length > 0) {
    parts.push(
      `최근 3개월간 ${sigungu} 아파트 실거래 내역입니다 (거래금액 상위).`,
    );
    parts.push('');
    parts.push('| 단지명 | 면적(㎡) | 거래가(만원) | 층 | 거래일 |');
    parts.push('|---|---|---|---|---|');
    for (const tx of recentTx) {
      parts.push(
        `| ${tx.apt_name || '-'} | ${tx.exclusive_area ?? '-'} | ${tx.deal_amount ? tx.deal_amount.toLocaleString() : '-'} | ${tx.floor ?? '-'} | ${tx.deal_date || '-'} |`,
      );
    }
    parts.push('');
    parts.push(
      `총 ${recentTx.length}건의 주요 거래가 확인됩니다. 전체 실거래 내역은 국토교통부 실거래가 공개시스템(rt.molit.go.kr)에서 확인하실 수 있습니다.`,
    );
  } else {
    parts.push(
      `최근 3개월간 ${sigungu} 내 실거래 데이터가 아직 등록되지 않았습니다. 국토교통부 실거래가 공개시스템에서 최신 거래를 확인해 주세요.`,
    );
  }
  parts.push('');

  // --- Investment points ---
  parts.push(`### 🔍 ${sigungu} 투자 포인트`);
  parts.push('');
  parts.push(
    `${region} ${sigungu}는 등록 단지 ${siteCount}개로 ${region} 내에서도 주요 주거 밀집 지역에 해당합니다.` +
      (maxPriceMax
        ? ` 시세 상위 단지 기준 최고 ${formatPrice(maxPriceMax)} 수준의 가격대가 형성되어 있어, 실거주 수요와 투자 수요가 공존하는 지역입니다.`
        : '') +
      (stations.length > 0
        ? ` 교통 측면에서 ${stations.slice(0, 3).join(', ')} 등 주요 거점이 인접해 있어 출퇴근 접근성이 양호합니다.`
        : '') +
      (schools.length > 0
        ? ` 학군 역시 ${schools.slice(0, 3).join(', ')} 등이 확인되어 자녀 교육 환경을 중시하는 수요층에게 매력적입니다.`
        : ''),
  );
  parts.push('');
  parts.push(
    `향후 지역 내 재개발·재건축, 교통 인프라 확충, 신규 공급 물량 등의 변수를 종합적으로 모니터링하며 투자 판단을 하시기 바랍니다. 금리 변동과 정부 부동산 정책 변화에도 유의가 필요합니다.`,
  );
  parts.push('');

  // --- Related links ---
  parts.push('### 관련 정보');
  parts.push('');
  parts.push(`- [카더라 아파트 정보 →](/apt)`);
  parts.push(`- [청약 정보 →](/apt/subscriptions)`);
  parts.push(
    `- [${region} 아파트 실거래 →](${SITE_URL}/blog?category=apt&region=${encodeURIComponent(region)})`,
  );
  parts.push('');

  // --- Disclaimer ---
  parts.push('---');
  parts.push('');
  parts.push(
    `> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 특정 부동산의 매수·매도를 권유하지 않습니다. 시세 정보는 작성 시점 기준이며 실제와 다를 수 있습니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다. 데이터 출처: 국토교통부 실거래가 공개시스템, 한국부동산원.`,
  );

  return parts.join('\n');
}

/* ================================================================== */
/*  MAIN HANDLER                                                       */
/* ================================================================== */
export const GET = withCronAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const offset = parseInt(params.get('offset') || '0', 10);
  const limit = parseInt(params.get('limit') || '40', 10);

  const admin = getSupabaseAdmin();
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const threeMonthsAgo = getThreeMonthsAgoDate();

  /* -------------------------------------------------------------- */
  /*  Step 1-3: Query distinct (region, sigungu) with count >= 3    */
  /* -------------------------------------------------------------- */
  const { data: districtRows, error: districtErr } = await admin.rpc(
    // @ts-expect-error rpc name
    'get_district_apt_counts',
  ).then(
    // If RPC doesn't exist, fall back to a raw approach
    (res: any) => res,
    () => ({ data: null, error: { message: 'rpc_not_found' } }),
  );

  // Fallback: direct query if RPC not available
  let districts: { region: string; sigungu: string; cnt: number }[] = [];

  if (districtRows && !districtErr) {
    districts = (districtRows as Record<string, unknown>[]).map((r: Record<string, any>) => ({
      region: r.region,
      sigungu: r.sigungu,
      cnt: Number(r.cnt),
    }));
  } else {
    // Fallback: fetch all active apt_sites and group in JS
    const { data: allSites, error: sitesErr } = await admin
      .from('apt_sites')
      .select('region, sigungu')
      .eq('is_active', true)
      .not('sigungu', 'is', null)
      .neq('sigungu', '');

    if (sitesErr) {
      console.error('[blog-district-guide] apt_sites fetch error:', sitesErr.message);
      return NextResponse.json({ ok: false, error: sitesErr.message });
    }

    if (!allSites || allSites.length === 0) {
      return NextResponse.json({ ok: true, created: 0, skipped: 0, message: 'no_apt_sites' });
    }

    // Group by region + sigungu
    const countMap = new Map<string, number>();
    for (const site of allSites) {
      if (!site.region || !site.sigungu) continue;
      const key = `${site.region}|||${site.sigungu}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    // Filter count >= 3 and sort
    districts = Array.from(countMap.entries())
      .filter(([, cnt]) => cnt >= 3)
      .map(([key, cnt]) => {
        const [region, sigungu] = key.split('|||');
        return { region, sigungu, cnt };
      })
      .sort((a, b) => a.region.localeCompare(b.region) || a.sigungu.localeCompare(b.sigungu));
  }

  if (districts.length === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: 0, total: 0, message: 'no_qualifying_districts' });
  }

  /* -------------------------------------------------------------- */
  /*  Step 4: Apply offset / limit                                   */
  /* -------------------------------------------------------------- */
  const batch = districts.slice(offset, offset + limit);

  /* -------------------------------------------------------------- */
  /*  Step 5: Process each sigungu sequentially                      */
  /* -------------------------------------------------------------- */
  let created = 0;
  let skipped = 0;

  for (const { region, sigungu, cnt } of batch) {
    try {
      const slug = `district-apt-${toSlugPart(region)}-${toSlugPart(sigungu)}-${yearMonth}`;
      const title = `${region} ${sigungu} 아파트 추천 2026 — 시세 TOP 10 단지와 학군·교통 분석`;

      // --- Query top 10 apt_sites by price_max DESC ---
      const { data: top10Raw, error: top10Err } = await admin
        .from('apt_sites')
        .select('name, address, total_units, built_year, price_min, price_max, nearby_station, school_district')
        .eq('is_active', true)
        .eq('region', region)
        .eq('sigungu', sigungu)
        .order('price_max', { ascending: false, nullsFirst: false })
        .limit(10);

      if (top10Err) {
        console.error(`[blog-district-guide] top10 error for ${region} ${sigungu}:`, top10Err.message);
        skipped++;
        continue;
      }

      const top10: AptSite[] = (top10Raw || []).map((r: any) => ({
        name: r.name || '단지',
        address: r.address,
        total_units: r.total_units,
        built_year: r.built_year,
        price_min: r.price_min,
        price_max: r.price_max,
        nearby_station: r.nearby_station,
        school_district: r.school_district,
      }));

      if (top10.length === 0) {
        skipped++;
        continue;
      }

      // --- Query recent transactions (last 3 months) ---
      const { data: txRaw } = await admin
        .from('apt_transactions')
        .select('apt_name, exclusive_area, deal_amount, floor, deal_date')
        .eq('sigungu', sigungu)
        .gte('deal_date', threeMonthsAgo)
        .order('deal_amount', { ascending: false, nullsFirst: false })
        .limit(10);

      const recentTx: RecentTx[] = (txRaw || []).map((r: any) => ({
        apt_name: r.apt_name,
        exclusive_area: r.exclusive_area,
        deal_amount: r.deal_amount,
        floor: r.floor,
        deal_date: r.deal_date,
      }));

      // --- Build content ---
      let content = buildContent(region, sigungu, cnt, top10, recentTx);
      content = ensureMinLength(content, 'apt', 1500);

      const tags = [region, sigungu, '아파트', '시세', '학군', '교통', '추천', '2026'];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content,
        excerpt: `${region} ${sigungu} 아파트 시세 TOP 10, 학군·교통 분석 — ${cnt}개 단지 중 추천 아파트 2026`,
        category: 'apt',
        tags,
        source_type: 'auto',
        cron_type: 'blog-district-guide',
        data_date: yearMonth,
        source_ref: 'apt_sites',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
        image_alt: generateImageAlt('apt', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[blog-district-guide] Error for ${region} ${sigungu}:`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    batch_size: batch.length,
    total_districts: districts.length,
    offset,
    limit,
  });
});
