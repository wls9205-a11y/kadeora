export const maxDuration = 300;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function toSlug(name: string) { return name.replace(/\s+/g, '-').replace(/[^가-힣a-zA-Z0-9-]/g, '').slice(0, 60); }
function fmtDate(d: string | null) { if (!d) return '-'; return d.slice(0, 10).replace(/-/g, '.'); }
function fmtPrice(v: number | null) { if (!v || v <= 0) return null; return v >= 10000 ? `${(v / 10000).toFixed(1)}억원` : `${v.toLocaleString()}만원`; }
function dDay(d: string | null) { if (!d) return ''; const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); return diff < 0 ? '마감' : diff === 0 ? 'D-Day' : `D-${diff}`; }

export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await withCronLogging('blog-apt-new', async () => {
    const admin = getSupabaseAdmin();
    let created = 0;

    // 1. 청약 현장 — 풍부한 컬럼
    const { data: apts } = await (admin as any).from('apt_subscriptions')
      .select('house_manage_no, house_nm, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, spsply_rcept_bgnde, spsply_rcept_endde, cntrct_cncls_bgnde, cntrct_cncls_endde, mdatrgbn_nm, mvn_prearnge_ym, supply_addr, constructor_nm, developer_nm, brand_name, is_price_limit, general_supply_total, special_supply_total, price_per_pyeong_avg, house_type_info, payment_schedule, community_facilities, heating_type, parking_ratio, balcony_extension, project_type, total_households, is_regulated_area, loan_rate, move_in_month, competition_rate_1st')
      .order('rcept_bgnde', { ascending: false }).limit(50);

    for (const apt of (apts ?? [])) {
      const slug = `apt-${toSlug(apt.house_nm)}-${apt.house_manage_no}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const region = apt.region_nm ?? '';
      const addr = apt.hssply_adres || apt.supply_addr || '';
      const shortAddr = addr ? addr.split(' ').slice(1, 4).join(' ') : '';
      const units = apt.tot_supply_hshld_co ?? apt.total_households ?? 0;
      const genSupply = apt.general_supply_total ?? 0;
      const specSupply = apt.special_supply_total ?? 0;
      const moveIn = apt.move_in_month || (apt.mvn_prearnge_ym ? apt.mvn_prearnge_ym.slice(0, 4) + '년 ' + parseInt(apt.mvn_prearnge_ym.slice(4, 6)) + '월' : '미정');
      const builder = apt.constructor_nm ?? '';
      const developer = apt.developer_nm ?? '';
      const brand = apt.brand_name ?? '';
      const priceLimit = apt.is_price_limit;
      const regulated = apt.is_regulated_area;
      const ppAvg = apt.price_per_pyeong_avg ? `평당 약 ${Math.round(apt.price_per_pyeong_avg).toLocaleString()}만원` : '';
      const parking = apt.parking_ratio ?? '';
      const heating = apt.heating_type ?? '';
      const typeInfo = apt.house_type_info ?? '';
      const projectType = apt.project_type ?? '';
      const competitionRate = apt.competition_rate_1st ?? '';
      const loanRate = apt.loan_rate ?? '';
      const dDayStr = dDay(apt.rcept_endde);

      const scaleDesc = units >= 3000 ? '3,000세대 이상의 초대형 단지로, 자체 학교·상가·공원 등 완결된 생활 인프라가 조성됩니다. 대규모 커뮨니티와 조경이 기대되며, 브랜드 대단지 프리미엄도 형성될 수 있습니다.'
        : units >= 1000 ? '1,000세대 이상의 대단지로, 피트니스·수영장·독서실 등 다양한 커뮤니티 시설이 예상됩니다. 관리비 효율도 장점입니다.'
        : units >= 500 ? '500세대 이상의 중대형 단지로, 기본 커뮤니티 시설과 적정 수준의 조경이 예상됩니다.'
        : '소규모 단지로, 조용한 주거 환경을 선호하는 수요자에게 적합합니다.';

      const content = `## ${apt.house_nm} ${region} 분양 완벽 가이드 — 청약 일정·분양가·입주·분석 총정리${dDayStr ? ` (${dDayStr})` : ''}

**${apt.house_nm}**은 ${region}${shortAddr ? ` ${shortAddr}` : ''}에 위치한 총 **${units.toLocaleString()}세대** 규모의 ${projectType ? `**${projectType}** ` : ''}아파트 단지입니다.${brand ? ` **${brand}** 브랜드로 공급됩니다.` : ''}${builder ? ` 시공은 **${builder}**가 맡았습니다.` : ''}${developer ? ` 시행사는 **${developer}**입니다.` : ''} 청약 접수는 **${fmtDate(apt.rcept_bgnde)}부터 ${fmtDate(apt.rcept_endde)}까지** 진행${dDayStr ? `되며, 현재 **${dDayStr}**입니다` : '됩니다'}. 입주 예정 시기는 **${moveIn}**입니다.

${priceLimit ? `이 단지는 **분양가 상한제** 적용 단지로, 주변 시세 대비 저렴한 분양가로 공급됩니다. ` : ''}${regulated ? `**규제지역**에 해당하여 전매 제한 및 실거주 의무가 적용됩니다. ` : ''}${ppAvg ? `분양가는 **${ppAvg}** 수준으로 ${priceLimit ? '상한제 적용에 따라 시세 대비 상당한 시세차익이 기대됩니다.' : '책정되었습니다.'}` : ''}

---

### 📋 기본 정보

| 항목 | 내용 |
|---|---|
| **단지명** | ${apt.house_nm} |
| **위치** | ${region} ${addr} |
| **총 세대수** | ${units.toLocaleString()}세대${genSupply || specSupply ? ` (일반 ${genSupply} · 특별 ${specSupply})` : ''} |
| **분양유형** | ${apt.mdatrgbn_nm ?? '-'}${projectType ? ` (${projectType})` : ''} |
${builder ? `| **시공사** | ${builder} |\n` : ''}${developer ? `| **시행사** | ${developer} |\n` : ''}${brand ? `| **브랜드** | ${brand} |\n` : ''}| **입주예정** | ${moveIn} |
${ppAvg ? `| **평당 분양가** | ${ppAvg} |\n` : ''}${priceLimit ? `| **분양가 상한제** | ✅ 적용 |\n` : ''}${regulated ? `| **규제지역** | ⚠️ 해당 |\n` : ''}

---

### 📅 청약 일정

| 일정 | 날짜 | 비고 |
|---|---|---|
${apt.spsply_rcept_bgnde ? `| **특별공급** | ${fmtDate(apt.spsply_rcept_bgnde)} ~ ${fmtDate(apt.spsply_rcept_endde)} | 다자녀·신혼·노부모·생애최초 |\n` : `| **특별공급** | ${fmtDate(apt.rcept_bgnde)} | 우선 접수 |\n`}| **1순위** | ${fmtDate(apt.rcept_bgnde)} ~ ${fmtDate(apt.rcept_endde)} | ${dDayStr || '일반공급'} |
| **당첨자 발표** | ${fmtDate(apt.przwner_presnatn_de)} | 청약홈 확인 |
${apt.cntrct_cncls_bgnde ? `| **계약 기간** | ${fmtDate(apt.cntrct_cncls_bgnde)} ~ ${fmtDate(apt.cntrct_cncls_endde)} | 계약금 준비 |\n` : ''}
청약 접수는 **청약홈(applyhome.co.kr)**에서 온라인으로 진행됩니다. 마감일 시스템 폭주에 대비해 **접수 시작일에 미리 신청**하시는 것을 권장합니다.

${competitionRate ? `> 📊 **1순위 경쟁률**: ${competitionRate}\n` : ''}
---

### 🏠 단지 분석${typeInfo ? `\n\n**평형 구성**: ${typeInfo}` : ''}

${scaleDesc}

${parking ? `**주차**: 세대당 ${parking}${parseFloat(parking) >= 130 ? '로 여유로운 주차가 가능합니다.' : parseFloat(parking) >= 100 ? '로 세대당 1대 이상 가능합니다.' : '입니다.'}` : ''}
${heating ? `\n**난방**: ${heating}` : ''}
${loanRate ? `\n**중도금 대출**: 금리 ${loanRate}` : ''}

---

### ❓ 자주 묻는 질문

**Q. ${apt.house_nm} 청약 자격은?**
A. ${region} 거주자로 주택청약종합저축 가입자여야 합니다.${regulated ? ' 규제지역으로 세대주·무주택·과거 5년 당첨이력 확인이 필요합니다.' : ''} 소득·자산 기준은 주택 유형별로 다릅니다.

**Q. 분양가 수준은?**
A. ${ppAvg ? `${ppAvg} 수준입니다. ${priceLimit ? '상한제 적용 단지로 주변 시세 대비 낮습니다.' : '주변 시세와 입지를 감안한 수준입니다.'}` : '모집공고문을 확인해주세요.'}

**Q. 입주 시기는?**
A. **${moveIn}** 예정입니다. 공사 진행에 따라 변동될 수 있습니다.

${genSupply && specSupply ? `**Q. 일반공급과 특별공급 세대수는?**\nA. 일반공급 ${genSupply}세대, 특별공급 ${specSupply}세대로 구성됩니다. 특별공급은 다자녀·신혼부부·노부모부양·생애최초 대상입니다.\n` : ''}
---

### 🔗 관련 정보

- [**${apt.house_nm}** 청약 상세 →](/apt/${apt.house_manage_no})
- [**${region}** 청약 일정 →](/apt?region=${encodeURIComponent(region)})
- [청약 **가점 계산기** →](/apt/diagnose)
- [**${region}** 실거래가 →](/apt?tab=trade&region=${encodeURIComponent(region)})
- [전국 미분양 현황 →](/apt?tab=unsold)
- [청약 커뮤니티 토론 →](/feed?category=apt)
- [**청약 마감 알림** 받기 →](/login)

---

**${apt.house_nm}** ${region} 분양 접수 기간은 ${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}입니다.${genSupply && specSupply ? ` 일반 ${genSupply}세대·특별 ${specSupply}세대 구성이니 자격 요건을 확인하세요.` : ''} 카더라에서 **D-1 알림**을 설정하면 놓치지 않습니다.${brand ? ` **${brand}** 브랜드의 높은 주거 만족도와 ` : ''}${priceLimit ? '상한제 혜택을 함께 누려보세요.' : ''}

> 청약홈(applyhome.co.kr) 공공데이터 기반. 정확한 일정·자격·분양가는 모집공고문을 확인하세요. 투자 권유가 아닙니다.`;

      const tags = [apt.house_nm, `${apt.house_nm} 분양`, `${region} 청약`, `${region} 분양`, '아파트 청약', '분양일정', '청약 가점', ...(brand ? [brand] : []), ...(builder ? [builder] : [])];
      const aptTitle = `${apt.house_nm} ${region} 분양 — 청약 일정·분양가·단지 분석 완벽 가이드${dDayStr ? ` (${dDayStr})` : ''}`;
      const _r = await safeBlogInsert(admin, {
        slug, title: aptTitle,
        content: ensureMinLength(content, 'apt'),
        excerpt: `${apt.house_nm} ${region} ${units.toLocaleString()}세대 ${projectType || '분양'}. ${ppAvg || ''} 접수 ${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}${dDayStr ? ` (${dDayStr})` : ''}. ${builder || brand || ''}`,
        category: 'apt', tags, source_ref: apt.house_manage_no,
        cron_type: 'apt-new', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(aptTitle)}&design=2&type=blog&category=apt`,
        image_alt: generateImageAlt('apt', aptTitle),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
      });
      if (_r.success) created++;
    }

    // 2. 미분양 — 풍부한 분석
    const { data: unsolds } = await (admin as any).from('unsold_apts')
      .select('id, house_nm, region_nm, sigungu_nm, tot_unsold_hshld_co, tot_supply_hshld_co, supply_addr, sale_price_min, sale_price_max, constructor_nm, developer_nm, discount_info, nearest_station, price_per_pyeong, completion_ym')
      .eq('is_active', true).limit(30);

    for (const u of (unsolds ?? [])) {
      const slug = `unsold-${toSlug(u.house_nm || '미분양')}-${u.id}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const pMin = fmtPrice(u.sale_price_min);
      const pMax = fmtPrice(u.sale_price_max);
      const priceRange = pMin && pMax ? `${pMin} ~ ${pMax}` : pMin || pMax || '-';
      const unsoldPct = u.tot_supply_hshld_co ? Math.round(((u.tot_unsold_hshld_co ?? 0) / u.tot_supply_hshld_co) * 100) : 0;
      const station = u.nearest_station ?? '';
      const discount = u.discount_info ?? '';
      const builder = u.constructor_nm ?? '';
      const completion = u.completion_ym ?? '';

      const severityDesc = unsoldPct >= 70 ? '미분양률이 매우 높아 시행사 재무 리스크를 반드시 확인해야 합니다. 다만 대폭 할인이나 특별 혜택을 기대할 수 있습니다.'
        : unsoldPct >= 40 ? '상당수 세대가 미분양 상태입니다. 분양가 할인, 옵션 무상 제공, 중도금 이자 지원 등의 혜택이 있는지 문의해보세요.'
        : unsoldPct >= 15 ? '일부 세대가 잔여 미분양 중입니다. 선호 타입이 남아 있다면 할인 혜택을 활용한 매수를 고려할 수 있습니다.'
        : '미분양률이 낮아 분양 마무리 단계입니다. 잔여 세대가 빠르게 소진될 수 있으니 서둘러 확인하세요.';

      const content = `## ${u.house_nm} ${u.region_nm} 미분양 완벽 분석 — 세대수·분양가·할인·투자 포인트

**${u.house_nm}**은 ${u.region_nm} ${u.sigungu_nm ?? ''}에 위치한 아파트 단지로, 전체 **${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대** 중 **${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대(${unsoldPct}%)**가 미분양입니다. 분양가 **${priceRange}** 수준입니다.${builder ? ` 시공 **${builder}**.` : ''}${station ? ` 최근접 역 **${station}**.` : ''}

${severityDesc}

${discount ? `> 💡 **현재 혜택**: ${discount}\n` : ''}
---

### 📋 현황

| 항목 | 내용 |
|---|---|
| **단지명** | ${u.house_nm} |
| **위치** | ${u.region_nm} ${u.sigungu_nm ?? ''}${u.supply_addr ? ` ${u.supply_addr}` : ''} |
| **미분양** | **${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대** (${unsoldPct}%) |
| **전체** | ${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대 |
| **분양가** | ${priceRange} |
${u.price_per_pyeong ? `| **평당가** | ${Math.round(u.price_per_pyeong).toLocaleString()}만원 |\n` : ''}${builder ? `| **시공사** | ${builder} |\n` : ''}${completion ? `| **준공** | ${completion} |\n` : ''}${station ? `| **최근접 역** | ${station} |\n` : ''}

---

### 📊 분석 및 투자 포인트

#### 1. 분양가 적정성
${u.price_per_pyeong ? `평당 **${Math.round(u.price_per_pyeong).toLocaleString()}만원** 수준으로,` : '분양가는'} ${u.region_nm} ${u.sigungu_nm ?? ''} 최근 실거래가와 비교 분석이 필요합니다. 미분양 단지는 **분양가 할인, 계약 조건 변경, 옵션 무상 제공** 등의 혜택으로 초기 분양가보다 유리하게 매수할 수 있습니다.

#### 2. 입지 분석
${station ? `최근접 역 **${station}**으로, 대중교통 접근성을 현장에서 직접 확인하시기 바랍니다.` : `대중교통, 학군, 생활 편의시설 등을 현장 답사를 통해 직접 확인하세요.`} ${u.region_nm} 지역의 개발 호재(GTX, 신도시 등)가 있다면 중장기 가치 상승을 기대할 수 있습니다.

#### 3. 리스크 체크리스트
- **시행사/시공사 재무 상태**: 분양 대금 관리 신탁 여부 확인
- **공정률**: 실제 공사 진행과 입주 시기 확인
- **주변 시세**: KB시세·실거래가 대비 분양가 적정성 분석
- **전매 가능 여부**: 전매 제한 기간 및 실거주 의무 확인
- **대출 가능 여부**: 잔금 대출 한도 및 금리 사전 확인

---

### ❓ FAQ

**Q. 미분양 아파트를 지금 사도 괜찮은가요?**
A. **할인 분양, 추가 혜택** 등으로 초기 분양가 대비 유리한 조건에 매수할 수 있습니다. 다만 미분양 원인을 정확히 분석하고, 시행사 재무 안정성을 반드시 확인하세요.

**Q. 미분양 할인 혜택은?**
A. 해당 현장 분양사무실에 직접 문의하거나, 카더라에서 최신 할인 정보를 확인하세요.${discount ? ` 현재: ${discount}` : ''}

**Q. 준공 후 미분양과 준공 전 미분양 차이는?**
A. **준공 후 미분양(악성 미분양)**은 완공되었지만 미계약으로, 즉시 입주 가능하지만 시장 신뢰도가 낮을 수 있습니다. 준공 전은 공사 중 물량으로, 건설 프리미엄을 기대할 수 있습니다.

---

### 🔗 관련

- [**${u.house_nm}** 미분양 상세 →](/apt/unsold/${u.id})
- [**${u.region_nm}** 미분양 현황 →](/apt?tab=unsold&region=${encodeURIComponent(u.region_nm)})
- [**${u.region_nm}** 실거래가 →](/apt?tab=trade&region=${encodeURIComponent(u.region_nm)})
- [전국 청약 일정 →](/apt)
- [부동산 커뮤니티 토론 →](/feed?category=apt)
- [**미분양 알림** 받기 →](/login)

---

**${u.house_nm}** ${u.region_nm} 미분양 정보가 도움이 되셨다면, 카더라에서 알림을 설정해보세요. 새 할인 정보나 잔여 세대 변동 시 바로 알려드립니다.

> 국토교통부 미분양주택현황 기반. 정확한 분양가·할인 조건은 해당 현장에 직접 확인하세요. 투자 권유가 아닙니다.`;

      const unsoldTitle = `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대 — 분양가·할인·투자 분석`;
      const _r = await safeBlogInsert(admin, {
        slug, title: unsoldTitle,
        content: ensureMinLength(content, 'unsold'),
        excerpt: `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대(${unsoldPct}%). 분양가 ${priceRange}.${discount ? ` 혜택: ${discount.slice(0, 50)}` : ''}`,
        category: 'unsold', 
        tags: [u.house_nm, `${u.house_nm} 미분양`, `${u.region_nm} 미분양`, '미분양 아파트', '할인 분양', ...(builder ? [builder] : [])],
        source_ref: String(u.id), cron_type: 'apt-new',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(unsoldTitle)}&design=2&type=blog&category=unsold`,
        image_alt: generateImageAlt('unsold', unsoldTitle),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('unsold', [`${u.house_nm} 미분양`, `${u.region_nm} 미분양`, '미분양 아파트', '할인 분양']),
      });
      if (_r.success) created++;
    }

    return { processed: ((apts ?? []).length + (unsolds ?? []).length), created, failed: 0, metadata: { api_name: 'anthropic', api_calls: 0 } };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, created: result.created });
} catch (e: unknown) {
    console.error('[cron/blog-apt-new]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
