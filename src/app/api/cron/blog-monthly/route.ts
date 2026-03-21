import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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

      await admin.from('blog_posts').insert({ slug, title: regTitle, content, excerpt: `${month} ${region} 지역 청약 ${apts.length}건 · ${totalUnits.toLocaleString()}세대.`, category: 'apt', tags: [`${region} 청약`, `${region} 분양`, '아파트 청약', '청약일정'], source_type: 'auto', cron_type: 'monthly', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(regTitle)}&type=blog` });
      created++;
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

      const content = `## 전국 미분양 현황 (${month})\n\n전국 미분양 총 **${total.toLocaleString()}세대**\n\n| 지역 | 미분양 세대 |\n|---|---|\n${table}\n\n---\n\n[미분양 상세 보기 →](/apt?tab=unsold)\n[부동산 소문 보기 →](/feed?category=apt)\n\n> 국토교통부 미분양주택현황 기반.`;

      await admin.from('blog_posts').insert({ slug: slugUnsold, title: `전국 미분양 아파트 ${total.toLocaleString()}세대 현황 (${month})`, content, excerpt: `${month} 전국 미분양 ${total.toLocaleString()}세대. 지역별 현황 정리.`, category: 'unsold', tags: ['미분양', '미분양아파트', '부동산'], source_type: 'auto' });
      created++;
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
        const bTable = budgetApts.map(a => `| ${a.house_nm} | ${a.region_nm} | ${(a.tot_unsold_hshld_co ?? 0).toLocaleString()} | ${a.sale_price_min ? (a.sale_price_min / 10000).toFixed(1) + '억' : '-'} |`).join('\n');
        const bTitle = `${b.label} 미분양 아파트 총정리 (${month})`;
        const bContent = `## ${bTitle}\n\n| 단지명 | 지역 | 미분양 | 분양가 |\n|---|---|---|---|\n${bTable}\n\n---\n\n[미분양 상세 보기 →](/apt?tab=unsold)\n[청약 일정 →](/apt)\n\n> 국토교통부 기반.`;
        await admin.from('blog_posts').insert({ slug: bSlug, title: bTitle, content: bContent, excerpt: `${b.label} 가격대 미분양 아파트 ${budgetApts.length}건.`, category: 'unsold', tags: [`${b.label} 미분양`, '미분양 아파트', '가격대별'], source_type: 'auto', cron_type: 'monthly', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(bTitle)}&type=blog` });
        created++;
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
        await admin.from('blog_posts').insert({ slug: calSlug, title: calTitle, content: calContent, excerpt: `${calMonth} 접수 예정 청약 ${calApts.length}건 캘린더.`, category: 'apt', tags: ['청약캘린더', `${calMonth} 청약`, '청약일정'], source_type: 'auto', cron_type: 'monthly', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(calTitle)}&type=blog` });
        created++;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-monthly]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
