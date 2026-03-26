export const maxDuration = 60;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const month = new Date().toISOString().slice(0, 7);
    let created = 0;

    // 지역별 청약 모음
    const REGIONS = ['서울', '경기', '부산', '인천', '대구'];
    for (const region of REGIONS) {
      const slug = `apt-region-${region}-${month}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const { data: apts } = await admin.from('apt_subscriptions')
        .select('house_nm, house_manage_no, rcept_bgnde, rcept_endde, tot_supply_hshld_co')
        .eq('region_nm', region).order('rcept_bgnde', { ascending: false }).limit(10);

      if (!apts || apts.length === 0) continue;

      const totalUnits = apts.reduce((s: number, a: any) => s + (a.tot_supply_hshld_co ?? 0), 0);
      const table = apts.map(a => `| [**${a.house_nm}**](/apt/${a.house_manage_no}) | ${a.rcept_bgnde?.slice(5) ?? '-'} ~ ${a.rcept_endde?.slice(5) ?? '-'} | ${(a.tot_supply_hshld_co ?? 0).toLocaleString()} |`).join('\n');
      const regTitle = `${region} 아파트 청약 ${apts.length}건 총정리 (${month})`;
      const content = `## ${region} 아파트 청약 ${apts.length}건 — ${month} 일정 총정리

${month} 기준 **${region}** 지역에서 접수 중이거나 접수 예정인 아파트 청약이 **${apts.length}건**, 총 **${totalUnits.toLocaleString()}세대** 규모입니다.

**${region}**은 수도권/광역시 중에서도 분양 수요가 꾸준한 지역으로, 매 분기 다양한 단지가 공급되고 있습니다. 청약 가점이 높지 않더라도 추첨제를 활용하면 기회를 잡을 수 있으니, 관심 있는 단지는 미리 일정을 확인해두세요.

---

### ${region} 청약 일정표

| 단지명 | 접수 기간 | 세대수 |
|---|---|---|
${table}

---

### ${region} 청약 분석

${apts.length >= 3 ? `이번 달 **${region}**에는 ${apts.length}개 단지가 분양됩니다. 총 ${totalUnits.toLocaleString()}세대 규모로, 다양한 평형과 가격대의 선택지가 있습니다. 접수 일정이 겹치는 단지가 있을 수 있으니, 중복 청약 규정을 반드시 확인하세요.` : `${region} 지역의 분양 물량은 ${apts.length}건으로, 관심 있는 단지의 모집공고를 꼼꼼히 확인한 후 청약하시길 권합니다.`}

**청약 준비 체크리스트:**
1. 청약통장 가입 기간 및 납입 횟수 확인
2. 무주택 요건 충족 여부 확인
3. 소득 기준 (특별공급 대상자 여부)
4. 가점 계산 및 전략 수립

---

### 관련 정보

- [**${region}** 전체 청약 일정 →](/apt)
- [**청약 마감 알림** 받기 →](/login)
- [청약 커뮤니티 **토론** →](/feed?category=apt)
- [전국 **미분양** 현황 →](/apt?tab=unsold)

카더라에서 **${region} 청약 알림**을 설정하면 접수 마감 전 알려드립니다.

> 청약홈(applyhome.co.kr) 공공데이터 기반. 정확한 정보는 청약홈에서 확인하세요.`;

      const _r = await safeBlogInsert(admin, { slug, title: regTitle, content: ensureMinLength(content, 'apt'), excerpt: `${month} ${region} 지역 청약 ${apts.length}건 · ${totalUnits.toLocaleString()}세대.`, category: 'apt', tags: [`${region} 청약`, `${region} 분양`, '아파트 청약', '청약일정'], cron_type: 'monthly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(regTitle)}&type=blog`, image_alt: generateImageAlt('apt', regTitle), meta_description: generateMetaDesc(content), meta_keywords: generateMetaKeywords('apt', [`${region} 청약`, `${region} 분양`, '아파트 청약', '청약일정']) });
      if (_r.success) created++;
    }

    // 미분양 월간 리포트
    const slugUnsold = `unsold-monthly-${month}`;
    const { data: eU } = await admin.from('blog_posts').select('id').eq('slug', slugUnsold).maybeSingle();
    if (!eU) {
      const { data: unsolds } = await admin.from('unsold_apts').select('region_nm, tot_unsold_hshld_co').eq('is_active', true);
      const byRegion: Record<string, number> = {};
      (unsolds ?? []).forEach(u => { byRegion[u.region_nm] = (byRegion[u.region_nm] ?? 0) + (u.tot_unsold_hshld_co ?? 0); });
      const total = Object.values(byRegion).reduce((s, v) => s + v, 0);
      const table = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).map(([r, c]) => `| ${r} | ${c.toLocaleString()} |`).join('\n');

      const regionCount = Object.keys(byRegion).length;
      const topRegion = Object.entries(byRegion).sort((a, b) => b[1] - a[1])[0];
      const unsoldTitle = `전국 미분양 아파트 ${total.toLocaleString()}세대 현황 (${month})`;
      const content = `## 전국 미분양 아파트 현황 — ${month} 지역별 분석

${month} 기준 전국 **미분양 아파트**는 총 **${total.toLocaleString()}세대**로 집계되었습니다. **${regionCount}개 지역**에서 미분양이 발생하고 있으며, 가장 많은 지역은 **${topRegion ? topRegion[0] : '-'}**(${topRegion ? topRegion[1].toLocaleString() : 0}세대)입니다.

미분양 아파트는 시장 상황에 따라 **할인 분양**, **중도금 무이자**, **옵션 무료 제공** 등 다양한 혜택이 제공되는 경우가 있어, 실수요자에게 기회가 될 수 있습니다. 다만, 미분양 발생 원인을 꼼꼼히 분석한 후 매수 결정을 내리는 것이 중요합니다.

---

### 지역별 미분양 현황

| 지역 | 미분양 세대 |
|---|---|
${table}

---

### 미분양 분석

전국 미분양 ${total.toLocaleString()}세대 중 **${topRegion ? topRegion[0] : '-'}** 지역이 전체의 약 **${topRegion ? Math.round((topRegion[1] / total) * 100) : 0}%**를 차지하고 있습니다. 미분양이 집중된 지역은 주로 **분양가 대비 주변 시세가 낮거나**, **교통·생활 인프라가 부족한 신도시/외곽 지역**인 경우가 많습니다.

미분양 아파트 매수를 고려할 때 반드시 체크해야 할 사항:

1. **미분양 원인 분석**: 분양가가 높은지, 입지가 불리한지, 시행사 문제인지 파악
2. **주변 시세 비교**: 인근 기존 아파트 실거래가와 비교하여 적정가 판단
3. **시행사/시공사 재무**: 공사 중단 리스크 확인
4. **입주 시기**: 실입주까지 남은 기간과 금리 변동 리스크

---

### 관련 정보

- [**미분양** 상세 목록 →](/apt?tab=unsold)
- [**청약 일정** 보기 →](/apt)
- [부동산 커뮤니티 **토론** →](/feed?category=apt)
- [**미분양 알림** 받기 →](/login)
- [카더라 **블로그** →](/blog?category=unsold)

미분양 현황은 매월 **국토교통부**에서 발표하며, 카더라에서 자동으로 업데이트됩니다. 관심 지역의 미분양 정보를 놓치지 마세요.

> 국토교통부 미분양주택현황 기반. 투자 권유가 아니며, 정확한 정보는 해당 시행사에 직접 확인하세요.`;

      const _r = await safeBlogInsert(admin, { slug: slugUnsold, title: unsoldTitle, content: ensureMinLength(content, 'unsold'), excerpt: `${month} 전국 미분양 ${total.toLocaleString()}세대. ${regionCount}개 지역 분석.`, category: 'unsold', tags: ['미분양', '미분양아파트', '부동산', '전국미분양'], cron_type: 'monthly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(unsoldTitle)}&type=blog`, image_alt: generateImageAlt('unsold', unsoldTitle), meta_description: generateMetaDesc(content), meta_keywords: generateMetaKeywords('unsold', ['미분양', '미분양아파트', '부동산', '전국미분양']) });
      if (_r.success) created++;
    }

    // 가격대별 미분양
    const BUDGETS = [
      { label: '3억 이하', slug: 'under-3', max: 30000 },
      { label: '3~5억', slug: '3-to-5', min: 30000, max: 50000 },
      { label: '5억 이상', slug: 'over-5', min: 50000 },
    ];
    for (const b of BUDGETS) {
      const bSlug = `unsold-budget-${b.slug}-${month}`;
      const { data: be } = await admin.from('blog_posts').select('id').eq('slug', bSlug).maybeSingle();
      if (be) continue;

      let bq = admin.from('unsold_apts').select('house_nm, region_nm, tot_unsold_hshld_co, sale_price_min, sale_price_max').eq('is_active', true);
      if (b.max) bq = bq.lte('sale_price_min', b.max);
      if (b.min) bq = bq.gte('sale_price_min', b.min);
      const { data: budgetApts } = await bq.order('sale_price_min').limit(15);

      if (budgetApts && budgetApts.length > 0) {
        const bTotalUnsold = budgetApts.reduce((s: number, a: any) => s + (a.tot_unsold_hshld_co ?? 0), 0);
        const bRegions = [...new Set(budgetApts.map((a: Record<string, any>) => a.region_nm))];
        const bTable = budgetApts.map(a => `| **${a.house_nm}** | ${a.region_nm} | ${(a.tot_unsold_hshld_co ?? 0).toLocaleString()} | ${a.sale_price_min ? (a.sale_price_min / 10000).toFixed(1) + '억' : '-'} |`).join('\n');
        const bTitle = `${b.label} 미분양 아파트 총정리 — ${month} 가격대별 분석`;
        const bContent = `## ${b.label} 미분양 아파트 현황 (${month})

${month} 기준 **${b.label}** 가격대의 미분양 아파트 현황을 정리했습니다. 전국적으로 **${budgetApts.length}건**, 총 **${bTotalUnsold.toLocaleString()}세대**가 미분양 상태입니다. 주요 분포 지역은 **${bRegions.slice(0, 3).join(', ')}** 등입니다.

${b.slug === 'under-3' ? '**3억 이하** 가격대는 실수요자와 신혼부부 특별공급 대상자에게 매력적인 가격대입니다. 미분양 단지의 경우 추가 할인이나 중도금 무이자 혜택이 제공될 수 있으므로, 시행사에 직접 문의해보는 것을 권합니다.' : b.slug === '3-to-5' ? '**3~5억** 가격대는 중산층 실수요자에게 가장 관심이 높은 구간입니다. 이 가격대의 미분양은 입지와 브랜드에 따라 향후 가치 상승 가능성이 다르므로, 주변 시세와 인프라를 꼼꼼히 비교해야 합니다.' : '**5억 이상** 가격대의 미분양은 주로 대형 평형이나 프리미엄 브랜드 단지에서 발생합니다. 분양가가 높은 만큼 금리 부담이 크지만, 입지가 좋은 단지는 장기적으로 가치가 인정받는 경우가 많습니다.'}

---

### ${b.label} 미분양 목록

| 단지명 | 지역 | 미분양 | 분양가 |
|---|---|---|---|
${bTable}

---

### 미분양 매수 시 체크리스트

1. **분양가 적정성**: 주변 기존 아파트 실거래가와 비교
2. **시행사 재무 상태**: 공사 중단 리스크 확인
3. **입주 시기**: 잔금 납부 시점의 금리 전망 고려
4. **할인 혜택**: 미분양 할인, 중도금 무이자, 옵션 무료 등 확인
5. **교통·학군**: 실거주 관점에서 생활 인프라 점검

---

### 관련 정보

- [**미분양** 전체 목록 →](/apt?tab=unsold)
- [**청약 일정** 보기 →](/apt)
- [부동산 **커뮤니티** →](/feed?category=apt)
- [**미분양 알림** 받기 →](/login)

카더라에서 매월 업데이트되는 가격대별 미분양 정보를 확인하세요.

> 국토교통부 미분양주택현황 기반. 투자 권유가 아닙니다.`;
        const _r = await safeBlogInsert(admin, { slug: bSlug, title: bTitle, content: ensureMinLength(bContent, 'unsold'), excerpt: `${b.label} 미분양 ${budgetApts.length}건 · ${bTotalUnsold.toLocaleString()}세대. ${bRegions.slice(0, 3).join(', ')}.`, category: 'unsold', tags: [`${b.label} 미분양`, '미분양 아파트', '가격대별', '부동산'], cron_type: 'monthly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(bTitle)}&type=blog`, image_alt: generateImageAlt('unsold', bTitle), meta_description: generateMetaDesc(bContent), meta_keywords: generateMetaKeywords('unsold', [`${b.label} 미분양`, '미분양 아파트', '가격대별', '부동산']) });
      if (_r.success) created++;
      }
    }

    // 캘린더 (다음달 청약 일정)
    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    const calMonth = nextMonth.toISOString().slice(0, 7);
    const calSlug = `calendar-${calMonth}`;
    const { data: calE } = await admin.from('blog_posts').select('id').eq('slug', calSlug).maybeSingle();
    if (!calE) {
      const calStart = nextMonth.toISOString().slice(0, 10);
      const calEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data: calApts } = await admin.from('apt_subscriptions')
        .select('house_nm, house_manage_no, region_nm, rcept_bgnde, rcept_endde')
        .gte('rcept_bgnde', calStart).lte('rcept_bgnde', calEnd)
        .order('rcept_bgnde').limit(20);

      if (calApts && calApts.length > 0) {
        const calTable = calApts.map(a => `| ${a.rcept_bgnde?.slice(5) ?? '-'} | [${a.house_nm}](/apt/${a.house_manage_no}) | ${a.region_nm} | ${a.rcept_endde?.slice(5) ?? '-'} |`).join('\n');
        const calTitle = `${calMonth.replace('-', '년 ')}월 아파트 청약 캘린더`;
        const calContent = `## ${calTitle}\n\n| 접수시작 | 단지명 | 지역 | 접수마감 |\n|---|---|---|---|\n${calTable}\n\n---\n\n[전체 청약 일정 →](/apt)\n[청약 마감 알림 받기 →](/login)\n\n> 청약홈 공공데이터 기반.`;
        const _r = await safeBlogInsert(admin, { slug: calSlug, title: calTitle, content: ensureMinLength(calContent, 'apt'), excerpt: `${calMonth} 접수 예정 청약 ${calApts.length}건 캘린더.`, category: 'apt', tags: ['청약캘린더', `${calMonth} 청약`, '청약일정'], cron_type: 'monthly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(calTitle)}&type=blog`, image_alt: generateImageAlt('apt', calTitle), meta_description: generateMetaDesc(calContent), meta_keywords: generateMetaKeywords('apt', ['청약캘린더', `${calMonth} 청약`, '청약일정']) });
      if (_r.success) created++;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-monthly]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 200 });
  }
}
