import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { withCronLogging } from '@/lib/cron-logger';

export const dynamic = 'force-dynamic';

function toSlug(name: string) {
  return name.replace(/\s+/g, '-').replace(/[^가-힣a-zA-Z0-9-]/g, '').slice(0, 60);
}

function fmtDate(d: string | null) {
  if (!d) return '-';
  return d.slice(0, 10).replace(/-/g, '.');
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await withCronLogging('blog-apt-new', async () => {
    const admin = getSupabaseAdmin();
    let created = 0;

    // 1. apt_subscriptions에서 블로그 없는 현장
    const { data: apts } = await admin.from('apt_subscriptions')
      .select('house_manage_no, house_nm, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, mdatrgbn_nm, mvn_prearnge_ym')
      .order('rcept_bgnde', { ascending: false }).limit(50);

    for (const apt of (apts ?? [])) {
      const slug = `apt-${toSlug(apt.house_nm)}-${apt.house_manage_no}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const region = apt.region_nm ?? '';
      const addr = apt.hssply_adres ?? '';
      const units = apt.tot_supply_hshld_co ?? 0;

      const moveIn = apt.mvn_prearnge_ym ? apt.mvn_prearnge_ym.slice(0, 4) + '년 ' + parseInt(apt.mvn_prearnge_ym.slice(4, 6)) + '월' : '미정';
      const content = `## ${apt.house_nm} ${region} 분양 — 청약 일정·세대수·입주 총정리

**${apt.house_nm}**은 ${region}에 위치한 총 **${units.toLocaleString()}세대** 규모의 아파트 단지입니다. ${apt.mdatrgbn_nm ? `분양유형은 **${apt.mdatrgbn_nm}**이며, ` : ''}청약 접수는 **${fmtDate(apt.rcept_bgnde)}부터 ${fmtDate(apt.rcept_endde)}까지** 진행됩니다. 입주 예정 시기는 **${moveIn}**입니다.

${region} 지역은 최근 분양 물량이 꾸준히 공급되고 있어 청약 대기자들의 관심이 높은 지역입니다. **${apt.house_nm}** 청약을 준비하시는 분들은 아래 일정과 세부 정보를 꼭 확인하세요.

---

### 기본 정보

| 항목 | 내용 |
|---|---|
| **단지명** | ${apt.house_nm} |
| **지역** | ${region} |
| **주소** | ${addr} |
| **총 세대수** | ${units.toLocaleString()}세대 |
| **분양유형** | ${apt.mdatrgbn_nm ?? '-'} |
| **입주예정** | ${moveIn} |

---

### 청약 일정

| 일정 | 날짜 |
|---|---|
| **특별공급 접수** | ${fmtDate(apt.rcept_bgnde)} |
| **1순위 접수** | ${fmtDate(apt.rcept_bgnde)} ~ ${fmtDate(apt.rcept_endde)} |
| **당첨자 발표** | ${fmtDate(apt.przwner_presnatn_de)} |

청약 접수는 **청약홈(applyhome.co.kr)**에서 온라인으로 진행됩니다. 접수 기간을 놓치지 않도록 미리 준비하시기 바랍니다.

---

### ${apt.house_nm} 분석 포인트

**${apt.house_nm}**의 총 ${units.toLocaleString()}세대 규모는 ${units >= 1000 ? '대단지로 커뮤니티 시설과 단지 내 편의시설이 잘 갖춰질 것으로 기대됩니다' : units >= 500 ? '중대형 단지로 적정 규모의 커뮤니티를 기대할 수 있습니다' : '소규모 단지로 조용한 주거 환경을 선호하는 분들에게 적합합니다'}. ${region} 지역의 교통, 학군, 생활 인프라 등을 종합적으로 고려하여 청약 여부를 결정하시는 것이 좋습니다.

청약 전 반드시 **청약 자격 요건**(무주택 여부, 소득 기준 등)과 **가점 점수**를 미리 확인하세요. 특별공급 대상자라면 일반공급보다 유리한 조건으로 청약할 수 있습니다.

---

### 관련 정보

- [**${apt.house_nm}** 청약 상세 페이지 →](/apt/${apt.house_manage_no})
- [**${region}** 전체 청약 일정 보기 →](/apt)
- [청약 관련 커뮤니티 토론 →](/feed?category=apt)
- [**청약 마감 알림** 받기 → 회원가입](/login)
- [전국 미분양 현황 확인 →](/apt?tab=unsold)

---

### 마무리

**${apt.house_nm}** ${region} 분양에 관심이 있다면, 접수 기간(${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)})을 캘린더에 등록해두세요. 카더라에서 **청약 마감 D-1 알림**을 받으면 놓칠 일이 없습니다.

> 본 콘텐츠는 청약홈(applyhome.co.kr) 공공데이터 기반이며, 정확한 일정과 자격 요건은 청약홈에서 확인하세요. 투자 권유가 아닙니다.`;

      const tags = [`${apt.house_nm} 분양`, `${region} 청약`, '아파트 청약', '분양일정'];
      const aptTitle = `${apt.house_nm} ${region} 분양 청약 일정 총정리`;
      const _r = await safeBlogInsert(admin, {
        slug, title: aptTitle,
        content: ensureMinLength(content, 'apt'), excerpt: `${apt.house_nm} ${region} ${units.toLocaleString()}세대 분양. 접수 ${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}.`,
        category: 'apt', tags, source_ref: apt.house_manage_no,
        cron_type: 'apt-new', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(aptTitle)}&type=blog`,
        image_alt: generateImageAlt('apt', aptTitle),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
      });
      if (_r.success) created++;
    }

    // 2. unsold_apts에서 블로그 없는 현장
    const { data: unsolds } = await admin.from('unsold_apts')
      .select('id, house_nm, region_nm, sigungu_nm, tot_unsold_hshld_co, tot_supply_hshld_co, sale_price_min, sale_price_max')
      .eq('is_active', true).limit(30);

    for (const u of (unsolds ?? [])) {
      const slug = `unsold-${toSlug(u.house_nm || '미분양')}-${u.id}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const pMin = u.sale_price_min ? (u.sale_price_min / 10000).toFixed(1) + '억' : '-';
      const pMax = u.sale_price_max ? (u.sale_price_max / 10000).toFixed(1) + '억' : '-';

      const unsoldPct = u.tot_supply_hshld_co ? Math.round(((u.tot_unsold_hshld_co ?? 0) / u.tot_supply_hshld_co) * 100) : 0;
      const content = `## ${u.house_nm} ${u.region_nm} 미분양 현황 — 세대수·분양가·분석

**${u.house_nm}**은 ${u.region_nm} ${u.sigungu_nm ?? ''}에 위치한 아파트 단지로, 현재 전체 **${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대** 중 **${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대**가 미분양 상태입니다. 미분양률은 약 **${unsoldPct}%**이며, 분양가는 **${pMin} ~ ${pMax}** 수준입니다.

최근 전국적으로 미분양 물량이 증가 추세에 있으며, ${u.region_nm} 지역도 예외는 아닙니다. 미분양 단지를 매수할 경우 분양가 할인이나 추가 혜택을 받을 수 있는 경우가 있으므로 꼼꼼히 따져보는 것이 좋습니다.

---

### 기본 정보

| 항목 | 내용 |
|---|---|
| **단지명** | ${u.house_nm} |
| **지역** | ${u.region_nm} ${u.sigungu_nm ?? ''} |
| **미분양 세대** | **${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대** |
| **전체 세대** | ${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대 |
| **미분양률** | ${unsoldPct}% |
| **분양가** | ${pMin} ~ ${pMax} |

---

### 미분양 분석

${unsoldPct >= 50 ? `**${u.house_nm}**의 미분양률이 ${unsoldPct}%로 상당히 높은 수준입니다. 이는 입지, 분양가, 주변 인프라 등 복합적인 요인이 작용한 결과일 수 있습니다. 매수를 고려한다면 **시행사의 재무 상태**와 **입주 시점의 시장 전망**을 반드시 확인하세요.` : unsoldPct >= 20 ? `**${u.house_nm}**의 미분양률은 ${unsoldPct}% 수준으로, 일부 세대가 미계약 상태입니다. 분양가 할인이나 옵션 무료 제공 등의 혜택이 있는지 시행사에 문의해보는 것을 권합니다.` : `**${u.house_nm}**의 미분양률은 ${unsoldPct}%로 비교적 낮은 수준입니다. 잔여 세대가 소진되기 전에 관심 있는 타입을 확인해보세요.`}

미분양 아파트 매수 시 체크리스트:
1. **시행사/시공사 재무 상태** 확인
2. **입주 예정일**과 실제 공정률 비교
3. **주변 시세** 대비 분양가 적정성 분석
4. **교통·학군·생활 인프라** 현장 답사

---

### 관련 정보

- [**${u.house_nm}** 미분양 상세 →](/apt/unsold/${u.id})
- [**${u.region_nm}** 미분양 전체 현황 →](/apt?tab=unsold)
- [부동산 커뮤니티 토론 →](/feed?category=apt)
- [**미분양 알림** 받기 → 회원가입](/login)
- [전국 청약 일정 확인 →](/apt)

---

**${u.house_nm}** ${u.region_nm} 미분양 정보가 도움이 되셨다면, 카더라에서 청약·미분양 알림을 설정해보세요. 새로운 정보가 업데이트되면 바로 알려드립니다.

> 국토교통부 미분양주택현황 기반. 정확한 정보는 해당 시행사에 직접 확인하세요. 투자 권유가 아닙니다.`;

      const unsoldTitle = `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대 현황`;
      const _r = await safeBlogInsert(admin, {
        slug, title: unsoldTitle,
        content: ensureMinLength(content, 'unsold'), excerpt: `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대. 분양가 ${pMin}~${pMax}.`,
        category: 'unsold', tags: [`${u.house_nm} 미분양`, `${u.region_nm} 미분양`, '미분양 아파트'], source_ref: String(u.id),
        cron_type: 'apt-new', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(unsoldTitle)}&type=blog`,
        image_alt: generateImageAlt('unsold', unsoldTitle),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('unsold', [`${u.house_nm} 미분양`, `${u.region_nm} 미분양`, '미분양 아파트']),
      });
      if (_r.success) created++;
    }

    return {
      processed: ((apts ?? []).length + (unsolds ?? []).length),
      created,
      failed: 0,
      metadata: { api_name: 'anthropic', api_calls: 0 },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, created: result.created });
}
