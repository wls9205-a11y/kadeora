import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

/**
 * 모집공고문 파싱 크론 (v2 — 최대 정보 추출)
 * 
 * applyhome.co.kr 상세 페이지 HTML에서 추출:
 * - 공급규모/위치, 주택형별 공급대상(일반/특별/계)
 * - 특별공급 상세 (다자녀/신혼부부/생애최초/청년/노부모/신생아/기관추천)
 * - 공급금액(주택형별 최고가), 입주예정월
 * - 시행사/시공사/브랜드명/문의처
 * - 규제지역 여부, 공고일/당첨일/계약일
 * - 모집공고문 PDF URL (2단계 총세대수 파싱용)
 * 
 * 배치 30건, 건당 300ms 대기
 */

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
};

const strip = (s: string): string => s.replace(/<[^>]+>/g, '').trim();

function parseRows(tableHtml: string): string[][] {
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  return rows.map(row => {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    return cells.map(c => strip(c));
  });
}

function parseAnnouncementHtml(html: string) {
  const data: Record<string, any> = {};
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // 1. 주요정보
  const scaleMatch = html.match(/공급규모[\s\S]{0,200}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (scaleMatch) data.supply_scale = num(strip(scaleMatch[1]));

  const locMatch = html.match(/공급위치[\s\S]{0,200}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (locMatch) data.supply_location = strip(locMatch[1]);

  const telMatch = html.match(/tel:([0-9-]+)/i);
  if (telMatch) data.contact_tel = telMatch[1];

  // 2. 청약일정
  const mojiMatch = html.match(/모집공고일[\s\S]{0,300}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (mojiMatch) {
    const t = strip(mojiMatch[1]);
    const d = t.match(/(\d{4}-\d{2}-\d{2})/);
    if (d) data.announcement_date = d[1];
    const m = t.match(/\(([^)]+)\)/);
    if (m) data.announcement_media = m[1];
  }

  const winMatch = html.match(/당첨자[\s\S]{0,100}?발표일[\s\S]{0,300}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (winMatch) { const d = strip(winMatch[1]).match(/(\d{4}-\d{2}-\d{2})/); if (d) data.winner_date = d[1]; }

  const conMatch = html.match(/계약일[\s\S]{0,300}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (conMatch) { const dates = strip(conMatch[1]).match(/(\d{4}-\d{2}-\d{2})/g); if (dates) data.contract_period = dates.join(' ~ '); }

  // 규제지역 / 특이사항
  const remarkMatch = html.match(/특이사항[\s\S]{0,50}?:[\s]*([\s\S]{0,200}?)(?:<\/li|<\/ul|<br)/i);
  if (remarkMatch) {
    const r = strip(remarkMatch[1]);
    data.is_regulated_area = /청약과열|투기과열|조정대상/.test(r);
    data.regulation_type = r;
  }

  // ══════ 건물 스펙 (신규) ══════
  // 총세대수 (단지 전체 — 공급세대가 아닌 전체)
  const totalHH = text.match(/총\s*세대수?\s*[:\s]*([0-9,]+)\s*세대/i) || text.match(/(\d{2,5})\s*세대\s*규모/i);
  if (totalHH) data.total_households = num(totalHH[1]);

  // 동수
  const dongMatch = text.match(/(\d{1,3})\s*개?\s*동\s*[\(（]/i) || text.match(/총\s*(\d{1,3})\s*개?\s*동/i) || text.match(/동\s*수\s*[:\s]*(\d{1,3})/i);
  if (dongMatch) { const v = num(dongMatch[1]); if (v && v <= 200) data.total_dong_count = v; }

  // 최고층/최저층
  const floorMatch = text.match(/지상\s*(\d{1,3})\s*층/i);
  if (floorMatch) data.max_floor = num(floorMatch[1]);
  const minFloor = text.match(/지하\s*(\d{1,2})\s*층/i);
  if (minFloor) data.min_floor = num(minFloor[1]);

  // 주차
  const parkMatch = text.match(/주차\s*대수?\s*[:\s]*([0-9,]+)\s*대/i) || text.match(/총\s*주차\s*[:\s]*([0-9,]+)/i);
  if (parkMatch) data.parking_total = num(parkMatch[1]);
  const parkRatio = text.match(/세대\s*당?\s*주차?\s*[:\s]*([\d.]+)\s*대/i);
  if (parkRatio) data.parking_ratio = parseFloat(parkRatio[1]);

  // 난방
  const heatMatch = text.match(/(개별난방|중앙난방|지역난방)\s*[\(（]?\s*(도시가스|LNG|심야전기|열병합)?/i);
  if (heatMatch) data.heating_type = [heatMatch[1], heatMatch[2]].filter(Boolean).join(' ');

  // 구조
  const structMatch = text.match(/(철근콘크리트|RC|벽식|라멘|무량판|철골)/i);
  if (structMatch) data.structure_type = structMatch[1];

  // 외장재
  const extMatch = text.match(/외장재?\s*[:\s]*([\w가-힣\+·]+(?:타일|석|비트|도장|패널|커튼월)[\w가-힣\+·]*)/i);
  if (extMatch) data.exterior_finish = extMatch[1].slice(0, 50);

  // ══════ 면적/용적 (신규) ══════
  const landMatch = text.match(/대지\s*면적?\s*[:\s]*([\d,.]+)\s*㎡/i);
  if (landMatch) data.land_area = parseFloat(landMatch[1].replace(/,/g, ''));
  const bldgMatch = text.match(/건축\s*면적?\s*[:\s]*([\d,.]+)\s*㎡/i);
  if (bldgMatch) data.building_area = parseFloat(bldgMatch[1].replace(/,/g, ''));
  const farMatch = text.match(/용적률?\s*[:\s]*([\d.]+)\s*%/i);
  if (farMatch) data.floor_area_ratio = parseFloat(farMatch[1]);
  const bcrMatch = text.match(/건폐율?\s*[:\s]*([\d.]+)\s*%/i);
  if (bcrMatch) data.building_coverage = parseFloat(bcrMatch[1]);

  // ══════ 금융/비용 (신규) ══════
  // 발코니 확장
  if (/발코니\s*확장/i.test(text)) {
    data.balcony_extension = true;
    const extCost = text.match(/발코니\s*확장\s*비?\s*[:\s]*([\d,]+)\s*만?\s*원?/i);
    if (extCost) data.balcony_extension_cost = num(extCost[1]);
  }

  // 중도금 대출 / 유이자·무이자
  if (/중도금\s*(?:대출\s*)?무이자/i.test(text)) {
    data.loan_available = true;
    data.loan_rate = '무이자';
  } else if (/중도금\s*(?:대출\s*)?유이자/i.test(text) || /이자\s*후불/i.test(text)) {
    data.loan_available = true;
    const rateMatch = text.match(/연\s*([\d.]+)\s*%/i);
    data.loan_rate = rateMatch ? `유이자 연 ${rateMatch[1]}%` : '유이자';
  } else if (/중도금\s*대출/i.test(text)) {
    data.loan_available = true;
  }

  // ══════ 규제/자격 (신규) ══════
  // 전매제한
  const transferMatch = text.match(/전매\s*(?:행위)?\s*제한\s*기간?\s*[:\s]*([\w가-힣\s]+?)(?:\.|,|$)/i);
  if (transferMatch) {
    data.transfer_limit = transferMatch[1].trim().slice(0, 80);
    const months = text.match(/전매\s*제한\s*(\d+)\s*(?:개월|월)/i);
    const years = text.match(/전매\s*제한\s*(\d+)\s*년/i);
    if (months) data.resale_restriction_months = num(months[1]);
    else if (years) data.resale_restriction_months = (num(years[1]) || 0) * 12;
  }

  // 거주의무
  const resMatch = text.match(/거주\s*의무\s*기간?\s*[:\s]*([\w가-힣\s]+?)(?:\.|,|$)/i);
  if (resMatch) {
    data.residence_obligation = resMatch[1].trim().slice(0, 80);
    const ry = text.match(/거주\s*의무\s*(\d+)\s*년/i);
    if (ry) data.residence_obligation_years = num(ry[1]);
  }

  // 청약저축 요건
  const savMatch = text.match(/(?:청약)?저축\s*가입\s*기간?\s*[:\s]*(\d+)\s*(?:개월|월)/i);
  if (savMatch) data.savings_requirement = `가입 ${savMatch[1]}개월 이상`;

  // 우선공급 지역
  const priorMatch = text.match(/(?:1순위|우선)\s*(?:공급)?\s*(?:지역|대상)\s*[:\s]*([\w가-힣\s·,]+?)(?:\.|<|$)/i);
  if (priorMatch) data.priority_supply_area = priorMatch[1].trim().slice(0, 100);

  // ══════ 시설/위치 (신규) ══════
  // 견본주택
  const modelMatch = text.match(/견본\s*주택\s*(?:위치|주소|장소)\s*[:\s]*([\w가-힣\d\s\-·,]+?)(?:전화|문의|<|$)/i);
  if (modelMatch) data.model_house_addr = modelMatch[1].trim().slice(0, 200);

  // 커뮤니티 시설
  const communityKeywords = ['피트니스', '헬스', '수영장', '독서실', '어린이집', 'GX룸', '사우나', '골프', '카페', '도서관', '경로당', '작은도서관', '키즈', '놀이터', '커뮤니티', 'IOT', '코인세탁'];
  const found = communityKeywords.filter(k => text.includes(k));
  if (found.length > 0) data.community_facilities = found;

  // 사업일정
  const approvalMatch = text.match(/사업\s*승인\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
  if (approvalMatch) data.business_approval_date = approvalMatch[1];
  const startMatch = text.match(/착공\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
  if (startMatch) data.construction_start_date = startMatch[1];
  const complMatch = text.match(/(?:준공|사용\s*검사)\s*(?:예정)?\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
  if (complMatch) data.completion_date = complMatch[1];

  // 사업유형
  if (/재개발/i.test(text)) data.project_type = '재개발';
  else if (/재건축/i.test(text)) data.project_type = '재건축';
  else if (/공공분양|국민임대|행복주택|신혼희망/i.test(text)) data.project_type = '공공';
  else if (/민간분양|민영/i.test(text)) data.project_type = '민간';

  // 3. 공급대상 테이블
  const supplyTbl = html.match(/공급대상[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (supplyTbl) {
    const rows = parseRows(supplyTbl[1]);
    const bd: any[] = [];
    let gT = 0, sT = 0;
    for (const cells of rows) {
      if (cells.length < 4 || cells.some(c => c === '주택형' || c === '주택 구분')) continue;
      if (cells[0] === '계' || cells[1] === '계') continue;
      let off = /민영|국민|공공|임대/.test(cells[0]) ? 1 : 0;
      const type = cells[off] || '';
      const area = cells[off + 1] || '';
      const gen = num(cells[off + 2]) || 0;
      const spc = num(cells[off + 3]) || 0;
      const tot = num(cells[off + 4]) || (gen + spc);
      if (type && tot > 0) {
        bd.push({ housing_type: /민영/.test(cells[0]) ? '민영' : /국민/.test(cells[0]) ? '국민' : '민영', type, supply_area: area, general: gen, special: spc, total: tot });
        gT += gen; sT += spc;
      }
    }
    if (bd.length) { data.supply_breakdown = bd; data.general_supply_total = gT; data.special_supply_total = sT; }
  }

  // 4. 특별공급 상세
  const specTbl = html.match(/특별공급\s*공급대상[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (specTbl) {
    const rows = parseRows(specTbl[1]);
    const sd: any[] = [];
    for (const cells of rows) {
      if (cells.length < 5 || !cells[0] || cells[0] === '주택형' || cells[0] === '계') continue;
      sd.push({
        type: cells[0], multi_child: num(cells[1]) || 0, newlywed: num(cells[2]) || 0,
        first_life: num(cells[3]) || 0, youth: num(cells[4]) || 0, elderly_parent: num(cells[5]) || 0,
        newborn: num(cells[6]) || 0, institution: num(cells[7]) || 0, relocation: num(cells[8]) || 0,
        other: num(cells[9]) || 0, total: num(cells[cells.length - 1]) || 0,
      });
    }
    if (sd.length) data.special_supply_detail = sd;
  }

  // 5. 공급금액
  const priceTbl = html.match(/공급금액[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (priceTbl) {
    const rows = parseRows(priceTbl[1]);
    const pi: any[] = [];
    for (const cells of rows) {
      if (cells.length < 2 || cells[0] === '주택형') continue;
      const p = num(cells[1]);
      if (cells[0] && p && p > 0) pi.push({ type: cells[0], price_max: p, deposit_info: cells[2] || null });
    }
    if (pi.length) data.supply_price_info = pi;
  }

  // 입주예정월
  const mvMatch = html.match(/입주예정월\s*[:\s]*([0-9]{4}[.\-/]?[0-9]{1,2})/i);
  if (mvMatch) data.move_in_month = mvMatch[1].trim();

  // 6. 기타사항 — 시행사/시공사
  const etcTbl = html.match(/기타사항[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (etcTbl) {
    const rows = parseRows(etcTbl[1]);
    for (const cells of rows) {
      if (cells.length >= 3 && cells[0] && !/시행사/.test(cells[0])) {
        data.developer_nm = cells[0];
        data.constructor_nm = cells[1];
        const t = cells[2]?.match(/[\d-]{7,}/);
        if (t) data.contact_tel = t[0];
      }
    }
  }

  // 브랜드명 추출
  if (data.constructor_nm) {
    const brands: Record<string, string> = {
      '삼성물산': '래미안', 'GS건설': '자이', '현대건설': '힐스테이트', '대우건설': '푸르지오',
      'DL이앤씨': '아크로', 'SK에코플랜트': 'SK VIEW', '포스코이앤씨': '더샵', '롯데건설': '롯데캐슬',
      '한화건설': '포레나', '호반건설': '호반써밋', 'HDC현대산업개발': '아이파크', '두산건설': '두산위브',
      '대림산업': 'e편한세상', 'DL건설': 'e편한세상', '태영건설': '데시앙', '제일건설': '제일풍경채',
      '한양': '수자인', '코오롱글로벌': '하늘채', '금호건설': '어울림', '현대엔지니어링': '힐스테이트',
    };
    for (const [builder, brand] of Object.entries(brands)) {
      if (data.constructor_nm.includes(builder)) { data.brand_name = brand; break; }
    }
  }

  // 7. PDF URL
  const pdfMatch = html.match(/href="([^"]*getAtchmnfl[^"]*)"/i);
  if (pdfMatch) {
    let u = pdfMatch[1].replace(/&amp;/g, '&');
    if (u.startsWith('/')) u = 'https://www.applyhome.co.kr' + u;
    data.announcement_pdf_url = u;
  }

  // 8. 푸터 공고일/매체
  const footMatch = html.match(/기타\s*자세한[\s\S]{0,200}?(\d{4}-\d{2}-\d{2})\s*\(([^)]+)\)/i);
  if (footMatch) {
    if (!data.announcement_date) data.announcement_date = footMatch[1];
    if (!data.announcement_media) data.announcement_media = footMatch[2];
  }

  return data;
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const sb = getSupabaseAdmin();

  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_manage_no, pblanc_url, house_nm')
    .is('announcement_parsed_at', null)
    .not('pblanc_url', 'is', null)
    .neq('pblanc_url', '')
    .order('rcept_bgnde', { ascending: false })
    .limit(50);

  if (!targets?.length) return NextResponse.json({ ok: true, message: '파싱 대상 없음', processed: 0 });

  let processed = 0, failed = 0;
  const errors: string[] = [];

  for (const apt of targets) {
    try {
      if (!apt.pblanc_url) { failed++; continue; }
      const res = await fetch(apt.pblanc_url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      });
      if (!res.ok) { failed++; await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id); continue; }

      const html = await res.text();
      const parsed = parseAnnouncementHtml(html);

      const ud: Record<string, any> = { announcement_parsed_at: new Date().toISOString() };
      // 기존 필드
      if (parsed.general_supply_total != null) ud.general_supply_total = parsed.general_supply_total;
      if (parsed.special_supply_total != null) ud.special_supply_total = parsed.special_supply_total;
      if (parsed.supply_breakdown) ud.supply_breakdown = parsed.supply_breakdown;
      if (parsed.special_supply_detail) ud.special_supply_detail = parsed.special_supply_detail;
      if (parsed.supply_price_info) ud.supply_price_info = parsed.supply_price_info;
      if (parsed.move_in_month) ud.move_in_month = parsed.move_in_month;
      if (parsed.developer_nm) ud.developer_nm = parsed.developer_nm;
      if (parsed.constructor_nm) ud.constructor_nm = parsed.constructor_nm;
      if (parsed.brand_name) ud.brand_name = parsed.brand_name;
      if (parsed.contact_tel) ud.contact_tel = parsed.contact_tel;
      if (parsed.is_regulated_area != null) ud.is_regulated_area = parsed.is_regulated_area;
      if (parsed.announcement_pdf_url) ud.announcement_pdf_url = parsed.announcement_pdf_url;
      // 건물 스펙 (신규 30개 필드)
      if (parsed.total_households) ud.total_households = parsed.total_households;
      if (parsed.total_dong_count) ud.total_dong_count = parsed.total_dong_count;
      if (parsed.max_floor) ud.max_floor = parsed.max_floor;
      if (parsed.min_floor) ud.min_floor = parsed.min_floor;
      if (parsed.parking_total) ud.parking_total = parsed.parking_total;
      if (parsed.parking_ratio) ud.parking_ratio = parsed.parking_ratio;
      if (parsed.heating_type) ud.heating_type = parsed.heating_type;
      if (parsed.structure_type) ud.structure_type = parsed.structure_type;
      if (parsed.exterior_finish) ud.exterior_finish = parsed.exterior_finish;
      // 면적
      if (parsed.land_area) ud.land_area = parsed.land_area;
      if (parsed.building_area) ud.building_area = parsed.building_area;
      if (parsed.floor_area_ratio) ud.floor_area_ratio = parsed.floor_area_ratio;
      if (parsed.building_coverage) ud.building_coverage = parsed.building_coverage;
      // 금융/비용
      if (parsed.balcony_extension != null) ud.balcony_extension = parsed.balcony_extension;
      if (parsed.balcony_extension_cost) ud.balcony_extension_cost = parsed.balcony_extension_cost;
      if (parsed.loan_available != null) ud.loan_available = parsed.loan_available;
      if (parsed.loan_rate) ud.loan_rate = parsed.loan_rate;
      // 규제/자격
      if (parsed.transfer_limit) ud.transfer_limit = parsed.transfer_limit;
      if (parsed.resale_restriction_months) ud.resale_restriction_months = parsed.resale_restriction_months;
      if (parsed.residence_obligation) ud.residence_obligation = parsed.residence_obligation;
      if (parsed.residence_obligation_years) ud.residence_obligation_years = parsed.residence_obligation_years;
      if (parsed.savings_requirement) ud.savings_requirement = parsed.savings_requirement;
      if (parsed.priority_supply_area) ud.priority_supply_area = parsed.priority_supply_area;
      // 시설/위치
      if (parsed.model_house_addr) ud.model_house_addr = parsed.model_house_addr;
      if (parsed.community_facilities?.length) ud.community_facilities = parsed.community_facilities;
      // 사업일정
      if (parsed.business_approval_date) ud.business_approval_date = parsed.business_approval_date;
      if (parsed.construction_start_date) ud.construction_start_date = parsed.construction_start_date;
      if (parsed.completion_date) ud.completion_date = parsed.completion_date;
      if (parsed.project_type) ud.project_type = parsed.project_type;

      // ━━━ 자동 계산 필드 ━━━
      // 분양가에서 납부일정 자동 계산 (계약금 10% / 중도금 60% / 잔금 30%)
      const prices = parsed.supply_price_info || [];
      if (prices.length > 0 && !ud.payment_schedule) {
        const maxPrice = Math.max(...prices.map((p: any) => p.price_max || 0));
        if (maxPrice > 0) {
          ud.payment_schedule = {
            deposit: { pct: 10, amount: Math.round(maxPrice * 0.1), label: '계약금' },
            interim: { pct: 60, amount: Math.round(maxPrice * 0.6), label: '중도금', loan: parsed.loan_rate || '확인필요' },
            balance: { pct: 30, amount: Math.round(maxPrice * 0.3), label: '잔금' },
            total: maxPrice,
          };
        }
      }
      // 취득세 자동 추정 (6억이하 1.1%, 6~9억 구간, 9억초과 3.3%)
      if (prices.length > 0) {
        const maxP = Math.max(...prices.map((p: any) => p.price_max || 0));
        if (maxP > 0) {
          const rate = maxP <= 60000 ? 0.011 : maxP <= 90000 ? 0.022 : 0.033;
          ud.acquisition_tax_estimate = Math.round(maxP * rate);
        }
      }
      // 세대당 주차비율 자동계산
      if (parsed.parking_total && !parsed.parking_ratio) {
        const { data: cur2 } = await (sb as any).from('apt_subscriptions').select('tot_supply_hshld_co').eq('id', apt.id).single();
        if (cur2?.tot_supply_hshld_co > 0) ud.parking_ratio = parseFloat((parsed.parking_total / cur2.tot_supply_hshld_co).toFixed(2));
      }

      // AI 요약 재생성 — DB 트리거가 처리하므로 여기서는 스킵 (트리거가 자동 갱신)

      await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
      processed++;
    } catch (err: any) {
      failed++;
      errors.push(`${apt.house_nm}: ${err.message?.slice(0, 60)}`);
      await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.info(`[apt-parse-announcement] processed=${processed} failed=${failed}`);
  return NextResponse.json({ ok: true, processed, failed, batch: targets.length, errors: errors.slice(0, 5) });
});
