export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/* ── 17 시도 정의 ── */
const REGIONS: { name: string; slug: string; patterns: string[] }[] = [
  { name: '서울', slug: 'seoul', patterns: ['서울%'] },
  { name: '부산', slug: 'busan', patterns: ['부산%'] },
  { name: '대구', slug: 'daegu', patterns: ['대구%'] },
  { name: '인천', slug: 'incheon', patterns: ['인천%'] },
  { name: '광주', slug: 'gwangju', patterns: ['광주%'] },
  { name: '대전', slug: 'daejeon', patterns: ['대전%'] },
  { name: '울산', slug: 'ulsan', patterns: ['울산%'] },
  { name: '세종', slug: 'sejong', patterns: ['세종%'] },
  { name: '경기', slug: 'gyeonggi', patterns: ['경기%'] },
  { name: '강원', slug: 'gangwon', patterns: ['강원%'] },
  { name: '충북', slug: 'chungbuk', patterns: ['충청북%', '충북%'] },
  { name: '충남', slug: 'chungnam', patterns: ['충청남%', '충남%'] },
  { name: '전북', slug: 'jeonbuk', patterns: ['전라북%', '전북%'] },
  { name: '전남', slug: 'jeonnam', patterns: ['전라남%', '전남%'] },
  { name: '경북', slug: 'gyeongbuk', patterns: ['경상북%', '경북%'] },
  { name: '경남', slug: 'gyeongnam', patterns: ['경상남%', '경남%'] },
  { name: '제주', slug: 'jeju', patterns: ['제주%'] },
];

interface AptRow {
  house_nm: string;
  competition_rate_1st: number | null;
  competition_rate_2nd: number | null;
  total_apply_count: number | null;
  supply_count: number | null;
  tot_supply_hshld_co: number | null;
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = parseInt(url.searchParams.get('limit') ?? '1', 10);

  const admin = getSupabaseAdmin();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = String(month).padStart(2, '0');
  const dateSlug = `${year}-${monthStr}`;
  const monthLabel = `${year}년 ${month}월`;

  const target = REGIONS.slice(offset, offset + limit);
  let created = 0;
  let skipped = 0;

  for (const region of target) {
    /* ── 1. Query apt_subscriptions for this region ── */
    let rows: AptRow[] = [];

    for (const pattern of region.patterns) {
      const { data } = await admin
        .from('apt_subscriptions')
        .select('house_nm, competition_rate_1st, competition_rate_2nd, total_apply_count, supply_count, tot_supply_hshld_co')
        .ilike('region_nm', pattern)
        .not('competition_rate_1st', 'is', null)
        .order('competition_rate_1st', { ascending: false })
        .limit(200);

      if (data) rows.push(...data);
    }

    // Deduplicate by house_nm (multiple patterns may overlap)
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = r.house_nm;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by competition_rate_1st DESC
    rows.sort((a, b) => (b.competition_rate_1st ?? 0) - (a.competition_rate_1st ?? 0));

    if (rows.length === 0) {
      skipped++;
      continue;
    }

    /* ── 2. Calculate metrics ── */
    const count = rows.length;
    const totalSupply = rows.reduce((s, r) => s + (r.supply_count ?? r.tot_supply_hshld_co ?? 0), 0);
    const avgRate = rows.reduce((s, r) => s + (r.competition_rate_1st ?? 0), 0) / count;
    const maxRate = rows[0].competition_rate_1st ?? 0;

    /* ── 3. Build content ── */
    const slug = `competition-rate-${region.slug}-${dateSlug}`;
    const title = `${region.name} 아파트 청약 경쟁률 분석 ${monthLabel} — 1순위 평균과 당첨 커트라인`;

    // 단지별 테이블
    const tableRows = rows
      .map(
        (r) =>
          `| ${r.house_nm} | ${(r.supply_count ?? r.tot_supply_hshld_co ?? 0).toLocaleString()}세대 | ${(r.competition_rate_1st ?? 0).toFixed(2)}:1 | ${(r.competition_rate_2nd ?? 0).toFixed(2)}:1 | ${(r.total_apply_count ?? 0).toLocaleString()}명 |`
      )
      .join('\n');

    // 프로그레스 바 (top 5)
    const top5 = rows.slice(0, 5);
    const barMax = top5[0]?.competition_rate_1st ?? 1;
    const progressBars = top5
      .map((r) => {
        const rate = r.competition_rate_1st ?? 0;
        const barLen = Math.max(1, Math.round((rate / barMax) * 20));
        return `${r.house_nm}: ${'█'.repeat(barLen)} ${rate.toFixed(2)}:1`;
      })
      .join('\n');

    // 당첨 전략 분석
    const strategyText =
      avgRate >= 10
        ? `${region.name} 지역의 평균 1순위 경쟁률이 ${avgRate.toFixed(2)}:1로 매우 높은 수준입니다. 가점제 비중이 높은 단지에서는 **청약 가점 50점 이상**을 확보해야 당첨 가능성이 있습니다. 무주택 기간, 부양가족 수, 청약통장 가입 기간 등 가점 항목을 미리 점검하세요. 추첨제 물량이 있는 전용 85㎡ 초과 타입이나 비규제지역 단지를 노리는 것도 전략입니다.`
        : avgRate >= 3
          ? `${region.name} 지역의 평균 1순위 경쟁률은 ${avgRate.toFixed(2)}:1로 중간 수준입니다. 인기 단지와 비인기 단지의 편차가 크므로, **입지와 분양가**를 꼼꼼히 비교 분석하여 당첨 확률이 높은 단지를 선별하는 것이 중요합니다. 특별공급(신혼부부, 생애최초 등) 자격이 있다면 적극 활용하세요.`
          : `${region.name} 지역의 평균 1순위 경쟁률은 ${avgRate.toFixed(2)}:1로 비교적 낮은 편입니다. 청약 가점이 낮은 분도 **1순위 당첨 기회**가 충분히 있습니다. 다만 경쟁률이 낮다는 것은 수요가 적다는 의미일 수 있으므로, 입주 후 전세 수요와 시세 전망 등을 함께 고려하세요.`;

    const content = `## ${region.name} 아파트 청약 경쟁률 분석 ${monthLabel}

### 📊 핵심 지표

| 항목 | 수치 |
|---|---|
| 접수 단지 | ${count}개 |
| 총 공급 세대 | ${totalSupply.toLocaleString()}세대 |
| 평균 1순위 경쟁률 | ${avgRate.toFixed(2)}:1 |
| 최고 1순위 경쟁률 | ${maxRate.toFixed(2)}:1 |

${monthLabel} 기준 **${region.name}** 지역의 아파트 청약 경쟁률 현황을 분석했습니다. 총 **${count}개 단지**, **${totalSupply.toLocaleString()}세대**가 공급되었으며, 1순위 평균 경쟁률은 **${avgRate.toFixed(2)}:1**, 최고 경쟁률은 **${maxRate.toFixed(2)}:1**을 기록했습니다.

---

### 🏢 단지별 경쟁률

| 단지명 | 공급 | 1순위 경쟁률 | 2순위 경쟁률 | 신청자수 |
|---|---|---|---|---|
${tableRows}

---

### 📈 경쟁률 프로그레스 바

${region.name} 지역 경쟁률 상위 ${top5.length}개 단지의 1순위 경쟁률을 시각화했습니다.

\`\`\`
${progressBars}
\`\`\`

---

### 🎯 당첨 전략

${strategyText}

청약을 준비할 때는 아래 사항도 함께 확인하세요:

1. **청약통장 납입 인정 회차**: 납입 횟수에 따라 순위가 결정되는 국민주택의 경우 특히 중요합니다.
2. **해당 지역 거주 기간**: 수도권, 광역시 등은 거주 기간에 따라 1순위 자격 조건이 달라집니다.
3. **특별공급 자격 확인**: 신혼부부, 생애최초, 다자녀, 노부모 부양 등 특별공급 조건에 해당하는지 확인하세요.
4. **분양가 상한제 적용 여부**: 분양가 상한제 적용 단지는 전매 제한 기간이 길지만, 시세 대비 저렴하게 분양받을 수 있습니다.

---

### 관련 정보

- [청약 일정 확인 →](/apt/subscriptions)
- [카더라 블로그 →](/blog?category=apt)

> 본 콘텐츠는 한국부동산원 청약홈 공공데이터 기반이며, 정확한 경쟁률과 청약 조건은 청약홈(applyhome.co.kr)에서 확인하세요. 투자 권유가 아닙니다.`;

    const finalContent = content;
    const tags = [`${region.name} 청약 경쟁률`, `${region.name} 아파트`, '청약 경쟁률', '1순위 경쟁률', '청약 당첨'];

    const result = await safeBlogInsert(admin, {
      slug,
      title,
      content: finalContent,
      excerpt: `${monthLabel} ${region.name} 아파트 청약 경쟁률 분석. 접수 ${count}개 단지, 평균 ${avgRate.toFixed(1)}:1, 최고 ${maxRate.toFixed(1)}:1.`,
      category: 'apt',
      tags,
      cron_type: 'blog-competition-rate',
      data_date: `${year}-${monthStr}-01`,
      source_ref: region.slug,
      is_published: true,
      cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&design=2&type=blog`,
      image_alt: generateImageAlt('apt', title),
      meta_description: generateMetaDesc(finalContent),
      meta_keywords: generateMetaKeywords('apt', tags),
    });

    if (result.success) created++;
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    processed: target.length,
    offset,
    limit,
  });
});
