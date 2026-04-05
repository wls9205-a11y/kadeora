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
function fmtWon(v: number | null | undefined) { if (!v || v <= 0) return null; return v >= 10000 ? `${(v / 10000).toFixed(1)}억원` : `${v.toLocaleString()}만원`; }
function dDay(d: string | null) { if (!d) return ''; const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); return diff < 0 ? '마감' : diff === 0 ? 'D-Day' : `D-${diff}`; }

// 타입별 분양가 테이블 생성
function buildPriceTable(info: any[]): string {
  if (!info || !Array.isArray(info) || info.length === 0) return '';
  const rows = info.map(t => {
    const area = t.area ? `${parseFloat(t.area).toFixed(1)}㎡` : '-';
    const exclusive = t.type ? `${parseFloat(t.type).toFixed(1)}㎡` : '-';
    const price = t.price_max ? fmtWon(t.price_max) : '-';
    const supply = (t.supply ?? 0) + (t.special ?? 0);
    return `| ${exclusive} | ${area} | ${price} | ${supply}세대 |`;
  }).join('\n');
  return `\n| 전용면적 | 공급면적 | 최고 분양가 | 공급 세대 |\n|---|---|---|---|\n${rows}\n`;
}

export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await withCronLogging('blog-apt-new', async () => {
    const admin = getSupabaseAdmin();
    let created = 0;

    // ━━━ 1. 청약 현장 — DB 모든 컬럼 총동원 ━━━
    const { data: apts } = await (admin as any).from('apt_subscriptions')
      .select(`house_manage_no, house_nm, region_nm, hssply_adres, tot_supply_hshld_co,
        rcept_bgnde, rcept_endde, przwner_presnatn_de, spsply_rcept_bgnde, spsply_rcept_endde,
        cntrct_cncls_bgnde, cntrct_cncls_endde, mdatrgbn_nm, mvn_prearnge_ym, supply_addr,
        constructor_nm, developer_nm, brand_name, is_price_limit, general_supply_total,
        special_supply_total, price_per_pyeong_avg, price_per_pyeong_min, price_per_pyeong_max, house_type_info, heating_type,
        parking_ratio, balcony_extension, project_type, total_households, is_regulated_area,
        loan_rate, move_in_month, competition_rate_1st, total_apply_count,
        ai_summary, supply_price_info, announcement_pdf_url, acquisition_tax_estimate,
        community_facilities, max_floor, total_dong_co, total_dong_count,
        transfer_limit, resale_restriction_months, residence_obligation_years,
        model_house_addr, extension_cost, balcony_extension_cost, nearest_station,
        nearest_school, school_district, station_distance, exclusive_ratio,
        floor_area_ratio, building_coverage, structure_type, parking_total`)
      .order('rcept_bgnde', { ascending: false }).limit(50);

    for (const apt of (apts ?? [])) {
      const slug = `apt-${toSlug(apt.house_nm)}-${apt.house_manage_no}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const r = apt.region_nm ?? '';
      const addr = apt.hssply_adres || apt.supply_addr || '';
      const shortAddr = addr ? addr.split(' ').slice(1, 4).join(' ') : '';
      const units = apt.tot_supply_hshld_co ?? apt.total_households ?? 0;
      const gen = apt.general_supply_total ?? 0;
      const spec = apt.special_supply_total ?? 0;
      const moveIn = apt.move_in_month || (apt.mvn_prearnge_ym ? apt.mvn_prearnge_ym.slice(0, 4) + '년 ' + parseInt(apt.mvn_prearnge_ym.slice(4, 6)) + '월' : '미정');
      const bld = apt.constructor_nm ?? '';
      const dev = apt.developer_nm ?? '';
      const brand = apt.brand_name ?? '';
      const dd = dDay(apt.rcept_endde);
      const ppa = apt.price_per_pyeong_min && apt.price_per_pyeong_max
        ? `평당 약 ${Math.round(apt.price_per_pyeong_min).toLocaleString()}~${Math.round(apt.price_per_pyeong_max).toLocaleString()}만원 (평균 ${Math.round(apt.price_per_pyeong_avg || apt.price_per_pyeong_min).toLocaleString()}만원)`
        : apt.price_per_pyeong_avg ? `평당 약 ${Math.round(apt.price_per_pyeong_avg).toLocaleString()}만원` : '';
      const parking = apt.parking_ratio ?? apt.parking_total ? `${apt.parking_ratio || Math.round((apt.parking_total || 0) / units * 100)}%` : '';
      const heating = apt.heating_type ?? '';
      const projectType = apt.project_type ?? '';
      const comp = apt.competition_rate_1st;
      const loanRate = apt.loan_rate ?? '';
      const pdfUrl = apt.announcement_pdf_url ?? '';
      const taxEst = apt.acquisition_tax_estimate ? fmtWon(apt.acquisition_tax_estimate) : '';
      const aiSum = apt.ai_summary ?? '';
      const comm = Array.isArray(apt.community_facilities) ? apt.community_facilities.join(', ') : '';
      const maxFl = apt.max_floor ?? '';
      const dongCo = apt.total_dong_co || apt.total_dong_count || '';
      const transfer = apt.transfer_limit ?? '';
      const resaleMonths = apt.resale_restriction_months ?? '';
      const resideYears = apt.residence_obligation_years ?? '';
      const balcony = apt.balcony_extension;
      const balconyCost = apt.balcony_extension_cost || apt.extension_cost;
      const station = apt.nearest_station ?? '';
      const stationDist = apt.station_distance ?? '';
      const school = apt.nearest_school ?? '';
      const schoolDistrict = apt.school_district ?? '';
      const modelHouse = apt.model_house_addr ?? '';
      const priceTable = buildPriceTable(apt.supply_price_info);
      const exRatio = apt.exclusive_ratio ?? '';
      const far = apt.floor_area_ratio ?? '';
      const bcr = apt.building_coverage ?? '';
      const structure = apt.structure_type ?? '';

      const scaleDesc = units >= 3000 ? '초대형 단지로 자체 학교·상가·공원 등 완결된 생활 인프라가 조성됩니다.'
        : units >= 1000 ? '대단지로 피트니스·수영장·독서실 등 다양한 커뮤니티 시설이 예상됩니다.'
        : units >= 500 ? '중대형 단지로 기본 커뮤니티와 적정 수준의 조경이 예상됩니다.'
        : '소규모 단지로 조용한 주거 환경을 선호하는 수요자에게 적합합니다.';

      const content = `## ${apt.house_nm} ${r} 분양 완벽 가이드${dd ? ` (${dd})` : ''} — 모집공고·분양가·타입별 가격·경쟁률·입주 총정리

${aiSum ? `> **한눈에 보기**: ${aiSum}` : `**${apt.house_nm}**은 ${r}${shortAddr ? ` ${shortAddr}` : ''}에 위치한 총 **${units.toLocaleString()}세대** 규모의 ${projectType || ''} 아파트입니다.`}

${brand ? `**${brand}** 브랜드로 공급되며, ` : ''}${bld ? `시공은 **${bld}**` : ''}${dev ? `, 시행은 **${dev}**` : ''}${bld || dev ? '입니다. ' : ''}청약 접수 **${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}**${dd ? ` (${dd})` : ''}, 입주 **${moveIn}**.

${apt.is_price_limit ? `> ✅ **분양가 상한제** 적용 단지 — 주변 시세 대비 저렴한 분양가로 시세차익 기대\n` : ''}${apt.is_regulated_area ? `> ⚠️ **규제지역** — 전매 제한${resaleMonths ? ` ${resaleMonths}개월` : ''} · 실거주 의무${resideYears ? ` ${resideYears}년` : ''}\n` : ''}
---

### 📋 단지 기본 정보

| 항목 | 내용 |
|---|---|
| **단지명** | ${apt.house_nm} |
| **위치** | ${r} ${addr} |
| **총 세대수** | ${units.toLocaleString()}세대${gen || spec ? ` (일반 ${gen} · 특별 ${spec})` : ''} |
| **분양유형** | ${apt.mdatrgbn_nm ?? '-'}${projectType ? ` (${projectType})` : ''} |
${bld ? `| **시공사** | ${bld} |\n` : ''}${dev ? `| **시행사** | ${dev} |\n` : ''}${brand ? `| **브랜드** | ${brand} |\n` : ''}| **입주예정** | ${moveIn} |
${dongCo ? `| **동 수** | ${dongCo}개 동 |\n` : ''}${maxFl ? `| **최고층** | ${maxFl}층 |\n` : ''}${structure ? `| **구조** | ${structure} |\n` : ''}${parking ? `| **주차비율** | 세대당 ${parking} |\n` : ''}${heating ? `| **난방** | ${heating} |\n` : ''}${far ? `| **용적률/건폐율** | ${far}% / ${bcr || '-'}% |\n` : ''}${exRatio ? `| **전용률** | ${exRatio}% |\n` : ''}${ppa ? `| **평당 분양가** | ${ppa} |\n` : ''}${apt.is_price_limit ? `| **분양가 상한제** | ✅ 적용 |\n` : ''}${taxEst ? `| **예상 취득세** | ${taxEst} |\n` : ''}${station ? `| **최근접 역** | ${station}${stationDist ? ` (${stationDist})` : ''} |\n` : ''}${school ? `| **학군** | ${school}${schoolDistrict ? ` (${schoolDistrict})` : ''} |\n` : ''}${comm ? `| **커뮤니티** | ${comm} |\n` : ''}${balcony !== null && balcony !== undefined ? `| **발코니 확장** | ${balcony ? `가능${balconyCost ? ` (${fmtWon(balconyCost)})` : ''}` : '확장 불가'} |\n` : ''}${modelHouse ? `| **모델하우스** | ${modelHouse} |\n` : ''}

---

### 📅 청약 일정 & 접수

| 일정 | 날짜 | 비고 |
|---|---|---|
${apt.spsply_rcept_bgnde ? `| **특별공급** | ${fmtDate(apt.spsply_rcept_bgnde)} ~ ${fmtDate(apt.spsply_rcept_endde)} | 다자녀·신혼·노부모·생애최초 |\n` : `| **특별공급** | ${fmtDate(apt.rcept_bgnde)} | 우선 접수 |\n`}| **1순위** | ${fmtDate(apt.rcept_bgnde)} ~ ${fmtDate(apt.rcept_endde)} | ${dd || '일반공급'} |
| **당첨자 발표** | ${fmtDate(apt.przwner_presnatn_de)} | 청약홈 확인 |
${apt.cntrct_cncls_bgnde ? `| **계약 기간** | ${fmtDate(apt.cntrct_cncls_bgnde)} ~ ${fmtDate(apt.cntrct_cncls_endde)} | 계약금 준비 |\n` : ''}
${comp ? `> 📊 **1순위 경쟁률 ${comp}:1**${apt.total_apply_count ? ` (총 ${apt.total_apply_count.toLocaleString()}명 신청)` : ''}\n` : ''}${pdfUrl ? `> 📄 [**모집공고문 PDF 원본 보기 →**](${pdfUrl})\n` : ''}
---
${priceTable ? `
### 💰 타입별 분양가 상세
${priceTable}
${ppa ? `평균 **${ppa}** 수준입니다. ` : ''}${apt.is_price_limit ? '분양가 상한제 적용으로 주변 시세 대비 저렴합니다.' : '주변 시세 대비 적정성을 분석하시기 바랍니다.'}${taxEst ? ` 예상 취득세는 약 **${taxEst}** 수준입니다.` : ''}

---
` : ''}
### 🏠 단지 분석

${scaleDesc}${dongCo ? ` 총 ${dongCo}개 동으로 구성됩니다.` : ''}${maxFl ? ` 최고 ${maxFl}층입니다.` : ''}

${station ? `**교통**: ${station}${stationDist ? ` ${stationDist}` : ''}에 위치하여 대중교통 이용이 편리합니다.` : ''}
${school || schoolDistrict ? `\n**학군**: ${school || ''}${schoolDistrict ? ` — ${schoolDistrict}` : ''}.` : ''}
${parking ? `\n**주차**: 세대당 ${parking}${parseFloat(parking) >= 130 ? '로 여유로운 주차가 가능합니다.' : '입니다.'}` : ''}
${comm ? `\n**커뮤니티**: ${comm}` : ''}
${loanRate ? `\n**중도금 대출**: ${loanRate}` : ''}

${transfer || resaleMonths ? `\n**전매제한**: ${transfer || ''}${resaleMonths ? ` (${resaleMonths}개월)` : ''}.${resideYears ? ` 실거주 의무 ${resideYears}년.` : ''}` : ''}

---

### ❓ 자주 묻는 질문

**Q. ${apt.house_nm} 청약 자격은?**
A. ${r} 거주자로 주택청약종합저축 가입자여야 합니다.${apt.is_regulated_area ? ` 규제지역으로 세대주·무주택·과거 5년 당첨이력 확인이 필요합니다.` : ''} 특별공급(${spec}세대)은 다자녀·신혼·노부모·생애최초 대상입니다.

**Q. 분양가 수준은?**
A. ${ppa ? `**${ppa}** 수준입니다.` : '모집공고문을 확인하세요.'}${apt.is_price_limit ? ' 상한제 적용으로 주변 시세 대비 시세차익이 기대됩니다.' : ''}${taxEst ? ` 예상 취득세 약 ${taxEst}.` : ''}

**Q. 입주·계약 일정은?**
A. 입주 **${moveIn}** 예정.${apt.cntrct_cncls_bgnde ? ` 계약 기간 ${fmtDate(apt.cntrct_cncls_bgnde)}~${fmtDate(apt.cntrct_cncls_endde)}.` : ''} 공사 진행에 따라 변동 가능합니다.

${comp ? `**Q. 경쟁률은 얼마나 되나요?**\nA. 1순위 경쟁률 **${comp}:1**${apt.total_apply_count ? ` (총 ${apt.total_apply_count.toLocaleString()}명 신청)` : ''}. 가점 확인이 중요합니다.\n` : ''}${balcony !== null && balcony ? `**Q. 발코니 확장은 가능한가요?**\nA. 네, 발코니 확장 가능합니다.${balconyCost ? ` 확장 비용은 약 ${fmtWon(balconyCost)}입니다.` : ''}\n` : ''}
---

### 🔗 관련 정보

- [**${apt.house_nm}** 청약 상세 페이지 →](/apt/${apt.house_manage_no})
${pdfUrl ? `- [📄 **모집공고문 PDF 원본** →](${pdfUrl})\n` : ''}- [**${r}** 전체 청약 일정 →](/apt?region=${encodeURIComponent(r)})
- [청약 **가점 계산기** →](/apt/diagnose)
- [**${r}** 실거래가 확인 →](/apt?tab=trade&region=${encodeURIComponent(r)})
- [전국 미분양 현황 →](/apt?tab=unsold)
- [청약 커뮤니티 토론 →](/feed?category=apt)
- [**청약 마감 D-1 알림** 받기 →](/login)

---

**${apt.house_nm}** ${r} 분양 접수 기간 ${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}${dd ? ` (${dd})` : ''}. ${gen && spec ? `일반 ${gen}세대·특별 ${spec}세대 구성이니 자격 요건을 확인하세요. ` : ''}${brand ? `**${brand}** 브랜드의 높은 주거 만족도` : ''}${apt.is_price_limit ? '와 상한제 혜택을 함께 누려보세요.' : '도 매력적입니다.'}

> ${pdfUrl ? `📄 [모집공고문 원본](${pdfUrl}) · ` : ''}청약홈(applyhome.co.kr) 공공데이터 기반. 정확한 일정·자격·분양가는 모집공고문 확인 필수. 투자 권유가 아닙니다.`;

      const tags = [apt.house_nm, `${apt.house_nm} 분양`, `${r} 청약`, `${r} 분양`, '아파트 청약', '분양일정', '청약 가점', ...(brand ? [brand] : []), ...(bld ? [bld] : [])];
      const aptTitle = `${apt.house_nm} ${r} 분양 — 모집공고·타입별 분양가·경쟁률·입주 완벽 가이드${dd ? ` (${dd})` : ''}`;
      const _r = await safeBlogInsert(admin, {
        slug, title: aptTitle,
        content: ensureMinLength(content, 'apt'),
        excerpt: `${apt.house_nm} ${r} ${units.toLocaleString()}세대 ${projectType || '분양'}. ${ppa || ''} 접수 ${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}${dd ? ` (${dd})` : ''}. ${bld || brand || ''}${comp ? ` 경쟁률 ${comp}:1` : ''}`,
        category: 'apt', tags, source_ref: apt.house_manage_no,
        cron_type: 'apt-new', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(aptTitle)}&design=2&type=blog&category=apt`,
        image_alt: generateImageAlt('apt', aptTitle),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
      });
      if (_r.success) created++;
    }

    // ━━━ 2. 미분양 현장 — 풍부한 분석 ━━━
    const { data: unsolds } = await (admin as any).from('unsold_apts')
      .select('id, house_nm, region_nm, sigungu_nm, tot_unsold_hshld_co, tot_supply_hshld_co, supply_addr, sale_price_min, sale_price_max, constructor_nm, developer_nm, discount_info, nearest_station, price_per_pyeong, completion_ym')
      .eq('is_active', true).limit(30);

    for (const u of (unsolds ?? [])) {
      const slug = `unsold-${toSlug(u.house_nm || '미분양')}-${u.id}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const pMin = fmtWon(u.sale_price_min);
      const pMax = fmtWon(u.sale_price_max);
      const priceRange = pMin && pMax ? `${pMin} ~ ${pMax}` : pMin || pMax || '-';
      const unsoldPct = u.tot_supply_hshld_co ? Math.round(((u.tot_unsold_hshld_co ?? 0) / u.tot_supply_hshld_co) * 100) : 0;
      const station = u.nearest_station ?? '';
      const discount = u.discount_info ?? '';
      const builder = u.constructor_nm ?? '';
      const completion = u.completion_ym ?? '';
      const ppPyeong = u.price_per_pyeong ? `평당 ${Math.round(u.price_per_pyeong).toLocaleString()}만원` : '';

      const severityDesc = unsoldPct >= 70 ? '미분양률이 매우 높아 시행사 재무 리스크를 확인해야 합니다. 대폭 할인 혜택 기대 가능.'
        : unsoldPct >= 40 ? '상당수 세대가 미분양입니다. 분양가 할인·옵션 무상·중도금 이자 지원 혜택을 문의하세요.'
        : unsoldPct >= 15 ? '일부 세대가 잔여 미분양. 선호 타입이 있다면 할인 혜택을 활용한 매수를 고려하세요.'
        : '미분양률이 낮아 분양 마무리 단계. 잔여 세대가 빠르게 소진될 수 있습니다.';

      const content = `## ${u.house_nm} ${u.region_nm} 미분양 완벽 분석 — 세대수·분양가·할인·투자 포인트

**${u.house_nm}** ${u.region_nm} ${u.sigungu_nm ?? ''} — 전체 **${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대** 중 **${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대(${unsoldPct}%)** 미분양. 분양가 **${priceRange}**${ppPyeong ? ` (${ppPyeong})` : ''}.${builder ? ` 시공 **${builder}**.` : ''}${station ? ` 최근접 역 **${station}**.` : ''}

${severityDesc}

${discount ? `> 💡 **현재 할인/혜택**: ${discount}\n` : ''}
---

### 📋 현황

| 항목 | 내용 |
|---|---|
| **단지명** | ${u.house_nm} |
| **위치** | ${u.region_nm} ${u.sigungu_nm ?? ''}${u.supply_addr ? ` ${u.supply_addr}` : ''} |
| **미분양** | **${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대** (${unsoldPct}%) |
| **전체** | ${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대 |
| **분양가** | ${priceRange} |
${ppPyeong ? `| **평당가** | ${ppPyeong} |\n` : ''}${builder ? `| **시공사** | ${builder} |\n` : ''}${completion ? `| **준공** | ${completion} |\n` : ''}${station ? `| **최근접 역** | ${station} |\n` : ''}

---

### 📊 투자 분석

#### 1. 분양가 적정성
${ppPyeong ? `**${ppPyeong}** 수준으로,` : '분양가는'} ${u.region_nm} ${u.sigungu_nm ?? ''} 최근 실거래가와 비교가 필요합니다. 미분양은 **분양가 할인, 옵션 무상, 계약 조건 변경** 등 초기 대비 유리하게 매수 가능합니다.

#### 2. 입지·인프라
${station ? `최근접 역 **${station}**. ` : ''}${u.region_nm} 지역 개발 호재(GTX, 신도시 등)가 있다면 중장기 가치 상승 기대.

#### 3. 리스크 체크
- 시행사/시공사 재무 · 분양 대금 관리 신탁
- 공정률 · 입주 시기 확인
- KB시세·실거래가 대비 분양가 적정성
- 전매 제한 · 실거주 의무 · 잔금 대출 한도/금리

---

### ❓ FAQ

**Q. 미분양 아파트를 지금 사도 괜찮은가요?**
A. **할인·추가 혜택**으로 초기 대비 유리합니다. 다만 미분양 원인을 분석하고 시행사 재무를 확인하세요.

**Q. 할인 혜택 확인법?**
A. 분양사무실 문의 또는 카더라 미분양 상세 페이지.${discount ? ` 현재: ${discount}` : ''}

**Q. 준공 후 vs 준공 전 미분양 차이?**
A. **준공 후(악성)**는 즉시 입주 가능, **준공 전**은 건설 프리미엄 기대.

---

### 🔗 관련

- [**${u.house_nm}** 미분양 상세 →](/apt/unsold/${u.id})
- [**${u.region_nm}** 미분양 현황 →](/apt?tab=unsold&region=${encodeURIComponent(u.region_nm)})
- [**${u.region_nm}** 실거래가 →](/apt?tab=trade&region=${encodeURIComponent(u.region_nm)})
- [전국 청약 일정 →](/apt) · [커뮤니티 →](/feed?category=apt) · [**알림** →](/login)

> 국토교통부 미분양주택현황 기반. 분양가·할인 조건은 현장 확인. 투자 권유 아닙니다.`;

      const unsoldTitle = `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대 — 분양가·할인·투자 분석`;
      const _r = await safeBlogInsert(admin, {
        slug, title: unsoldTitle,
        content: ensureMinLength(content, 'unsold'),
        excerpt: `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대(${unsoldPct}%). ${priceRange}.${discount ? ` 혜택: ${discount.slice(0, 50)}` : ''}`,
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
