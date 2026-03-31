/**
 * 모집공고 HTML 파서 — 공유 모듈
 * 크론(apt-parse-announcement) + 배치(batch-reparse)에서 공통 사용
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

export function parseAnnouncementHtml(html: string): Record<string, any> {
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
    const d = t.match(/(\d{4}-\d{2}-\d{2})/); if (d) data.announcement_date = d[1];
    const m = t.match(/\(([^)]+)\)/); if (m) data.announcement_media = m[1];
  }
  const winMatch = html.match(/당첨자[\s\S]{0,100}?발표일[\s\S]{0,300}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (winMatch) { const d = strip(winMatch[1]).match(/(\d{4}-\d{2}-\d{2})/); if (d) data.winner_date = d[1]; }
  const conMatch = html.match(/계약일[\s\S]{0,300}?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (conMatch) { const dates = strip(conMatch[1]).match(/(\d{4}-\d{2}-\d{2})/g); if (dates) data.contract_period = dates.join(' ~ '); }

  // 규제지역
  const remarkMatch = html.match(/특이사항[\s\S]{0,50}?:[\s]*([\s\S]{0,200}?)(?:<\/li|<\/ul|<br)/i);
  if (remarkMatch) {
    const r = strip(remarkMatch[1]);
    data.is_regulated_area = /청약과열|투기과열|조정대상/.test(r);
    data.regulation_type = r;
  }

  // ══════ 건물 스펙 (PDF에만 있을 수 있음 — text에서 최대한 추출) ══════
  const totalHH = text.match(/총\s*세대수?\s*[:\s]*([0-9,]+)\s*세대/i) || text.match(/(\d{2,5})\s*세대\s*규모/i);
  if (totalHH) data.total_households = num(totalHH[1]);
  const dongMatch = text.match(/(\d{1,3})\s*개?\s*동\s*[\(（]/i) || text.match(/총\s*(\d{1,3})\s*개?\s*동/i);
  if (dongMatch) { const v = num(dongMatch[1]); if (v && v <= 200) data.total_dong_count = v; }
  const floorMatch = text.match(/지상\s*(\d{1,3})\s*층/i);
  if (floorMatch) data.max_floor = num(floorMatch[1]);
  const minFloor = text.match(/지하\s*(\d{1,2})\s*층/i);
  if (minFloor) data.min_floor = num(minFloor[1]);
  const parkMatch = text.match(/주차\s*대수?\s*[:\s]*([0-9,]+)\s*대/i);
  if (parkMatch) data.parking_total = num(parkMatch[1]);
  const heatMatch = text.match(/(개별난방|중앙난방|지역난방)\s*[\(（]?\s*(도시가스|LNG|심야전기|열병합)?/i);
  if (heatMatch) data.heating_type = [heatMatch[1], heatMatch[2]].filter(Boolean).join(' ');
  const structMatch = text.match(/(철근콘크리트|RC|벽식|라멘|무량판|철골)/i);
  if (structMatch) data.structure_type = structMatch[1];
  const extMatch = text.match(/외장재?\s*[:\s]*([\w가-힣\+·]+(?:타일|석|비트|도장|패널|커튼월)[\w가-힣\+·]*)/i);
  if (extMatch) data.exterior_finish = extMatch[1].slice(0, 50);

  // ══════ 면적 ══════
  const landMatch = text.match(/대지\s*면적?\s*[:\s]*([\d,.]+)\s*㎡/i);
  if (landMatch) data.land_area = parseFloat(landMatch[1].replace(/,/g, ''));
  const bldgMatch = text.match(/건축\s*면적?\s*[:\s]*([\d,.]+)\s*㎡/i);
  if (bldgMatch) data.building_area = parseFloat(bldgMatch[1].replace(/,/g, ''));
  const farMatch = text.match(/용적률?\s*[:\s]*([\d.]+)\s*%/i);
  if (farMatch) data.floor_area_ratio = parseFloat(farMatch[1]);
  const bcrMatch = text.match(/건폐율?\s*[:\s]*([\d.]+)\s*%/i);
  if (bcrMatch) data.building_coverage = parseFloat(bcrMatch[1]);

  // ══════ 금융 ══════
  if (/발코니\s*확장/i.test(text)) {
    data.balcony_extension = true;
    const ec = text.match(/발코니\s*확장\s*비?\s*[:\s]*([\d,]+)\s*만?\s*원?/i);
    if (ec) data.balcony_extension_cost = num(ec[1]);
  }
  if (/중도금\s*(?:대출\s*)?무이자/i.test(text)) { data.loan_available = true; data.loan_rate = '무이자'; }
  else if (/중도금\s*(?:대출\s*)?유이자|이자\s*후불/i.test(text)) {
    data.loan_available = true;
    const rm = text.match(/연\s*([\d.]+)\s*%/i);
    data.loan_rate = rm ? `유이자 연 ${rm[1]}%` : '유이자';
  } else if (/중도금\s*대출/i.test(text)) { data.loan_available = true; }

  // ══════ 규제/자격 ══════
  const tfM = text.match(/전매\s*(?:행위)?\s*제한\s*기간?\s*[:\s]*([\w가-힣\s]+?)(?:\.|,|$)/i);
  if (tfM) {
    data.transfer_limit = tfM[1].trim().slice(0, 80);
    const m = text.match(/전매\s*제한\s*(\d+)\s*(?:개월|월)/i);
    const y = text.match(/전매\s*제한\s*(\d+)\s*년/i);
    if (m) data.resale_restriction_months = num(m[1]);
    else if (y) data.resale_restriction_months = (num(y[1]) || 0) * 12;
  }
  const resM = text.match(/거주\s*의무\s*기간?\s*[:\s]*([\w가-힣\s]+?)(?:\.|,|$)/i);
  if (resM) {
    data.residence_obligation = resM[1].trim().slice(0, 80);
    const ry = text.match(/거주\s*의무\s*(\d+)\s*년/i);
    if (ry) data.residence_obligation_years = num(ry[1]);
  }
  const savM = text.match(/(?:청약)?저축\s*가입\s*기간?\s*[:\s]*(\d+)\s*(?:개월|월)/i);
  if (savM) data.savings_requirement = `가입 ${savM[1]}개월 이상`;
  const priM = text.match(/(?:1순위|우선)\s*(?:공급)?\s*(?:지역|대상)\s*[:\s]*([\w가-힣\s·,]+?)(?:\.|<|$)/i);
  if (priM) data.priority_supply_area = priM[1].trim().slice(0, 100);

  // ══════ 시설 ══════
  const modelMatch = text.match(/견본\s*주택\s*(?:위치|주소|장소)\s*[:\s]*([\w가-힣\d\s\-·,]+?)(?:전화|문의|<|$)/i);
  if (modelMatch) data.model_house_addr = modelMatch[1].trim().slice(0, 200);
  const comKw = ['피트니스','헬스','수영장','독서실','어린이집','GX룸','사우나','골프','카페','도서관','경로당','키즈','놀이터','커뮤니티','코인세탁'];
  const found = comKw.filter(k => text.includes(k));
  if (found.length) data.community_facilities = found;

  // 사업일정
  const appM = text.match(/사업\s*승인\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
  if (appM) data.business_approval_date = appM[1];
  const stM = text.match(/착공\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
  if (stM) data.construction_start_date = stM[1];
  const compM = text.match(/(?:준공|사용\s*검사)\s*(?:예정)?\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
  if (compM) data.completion_date = compM[1];
  if (/재개발/i.test(text)) data.project_type = '재개발';
  else if (/재건축/i.test(text)) data.project_type = '재건축';
  else if (/공공분양|국민임대|행복주택|신혼희망/i.test(text)) data.project_type = '공공';
  else if (/민간분양|민영/i.test(text)) data.project_type = '민간';

  // 3. 공급대상 테이블
  const supplyTbl = html.match(/공급대상[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (supplyTbl) {
    const rows = parseRows(supplyTbl[1]);
    const bd: any[] = []; let gT = 0, sT = 0;
    for (const cells of rows) {
      if (cells.length < 4 || cells.some(c => c === '주택형' || c === '주택 구분')) continue;
      if (cells[0] === '계' || cells[1] === '계') continue;
      const off = /민영|국민|공공|임대/.test(cells[0]) ? 1 : 0;
      const type = cells[off] || '', area = cells[off + 1] || '';
      const gen = num(cells[off + 2]) || 0, spc = num(cells[off + 3]) || 0;
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
      sd.push({ type: cells[0], multi_child: num(cells[1]) || 0, newlywed: num(cells[2]) || 0, first_life: num(cells[3]) || 0, youth: num(cells[4]) || 0, elderly_parent: num(cells[5]) || 0, newborn: num(cells[6]) || 0, institution: num(cells[7]) || 0, relocation: num(cells[8]) || 0, other: num(cells[9]) || 0, total: num(cells[cells.length - 1]) || 0 });
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
        data.developer_nm = cells[0]; data.constructor_nm = cells[1];
        const t = cells[2]?.match(/[\d-]{7,}/); if (t) data.contact_tel = t[0];
      }
    }
  }

  // 브랜드
  if (data.constructor_nm) {
    const brands: Record<string, string> = {
      '삼성물산': '래미안', 'GS건설': '자이', '현대건설': '힐스테이트', '대우건설': '푸르지오',
      'DL이앤씨': '아크로', 'SK에코플랜트': 'SK VIEW', '포스코이앤씨': '더샵', '롯데건설': '롯데캐슬',
      '한화건설': '포레나', '호반건설': '호반써밋', 'HDC현대산업개발': '아이파크', '두산건설': '두산위브',
      '대림산업': 'e편한세상', 'DL건설': 'e편한세상', '태영건설': '데시앙', '제일건설': '제일풍경채',
      '한양': '수자인', '코오롱글로벌': '하늘채', '금호건설': '어울림', '현대엔지니어링': '힐스테이트',
      '중흥건설': 'S-클래스', '우미건설': '우미린', '에이치엘디앤아이한라': '에피트', '한라': '에피트',
      '쌍용건설': '더플래티넘', '계룡건설': '리슈빌',
    };
    for (const [builder, brand] of Object.entries(brands)) {
      if (data.constructor_nm.includes(builder)) { data.brand_name = brand; break; }
    }
  }

  // 7. PDF
  const pdfMatch = html.match(/href="([^"]*getAtchmnfl[^"]*)"/i);
  if (pdfMatch) {
    let u = pdfMatch[1].replace(/&amp;/g, '&');
    if (u.startsWith('/')) u = 'https://www.applyhome.co.kr' + u;
    data.announcement_pdf_url = u;
  }

  // 8. 푸터
  const footMatch = html.match(/기타\s*자세한[\s\S]{0,200}?(\d{4}-\d{2}-\d{2})\s*\(([^)]+)\)/i);
  if (footMatch) {
    if (!data.announcement_date) data.announcement_date = footMatch[1];
    if (!data.announcement_media) data.announcement_media = footMatch[2];
  }

  return data;
}

/** 파싱 결과 → DB 업데이트 dict 변환 */
export function buildUpdateDict(parsed: Record<string, any>, totSupply?: number): Record<string, any> {
  const ud: Record<string, any> = { announcement_parsed_at: new Date().toISOString() };
  const fields = [
    'general_supply_total','special_supply_total','supply_breakdown','special_supply_detail',
    'supply_price_info','move_in_month','developer_nm','constructor_nm','brand_name','contact_tel',
    'announcement_pdf_url','total_households','total_dong_count','max_floor','min_floor',
    'parking_total','parking_ratio','heating_type','structure_type','exterior_finish',
    'land_area','building_area','floor_area_ratio','building_coverage',
    'balcony_extension','balcony_extension_cost','loan_available','loan_rate',
    'transfer_limit','resale_restriction_months','residence_obligation','residence_obligation_years',
    'savings_requirement','priority_supply_area','model_house_addr','community_facilities',
    'business_approval_date','construction_start_date','completion_date','project_type',
  ];
  for (const f of fields) {
    if (parsed[f] != null && parsed[f] !== '') ud[f] = parsed[f];
  }
  if (parsed.is_regulated_area != null) ud.is_regulated_area = parsed.is_regulated_area;

  // 자동 계산: 납부일정
  const prices = parsed.supply_price_info || [];
  if (prices.length > 0) {
    const maxPrice = Math.max(...prices.map((p: any) => p.price_max || 0));
    if (maxPrice > 0) {
      ud.payment_schedule = {
        deposit: { pct: 10, amount: Math.round(maxPrice * 0.1), label: '계약금' },
        interim: { pct: 60, amount: Math.round(maxPrice * 0.6), label: '중도금', loan: parsed.loan_rate || '확인필요' },
        balance: { pct: 30, amount: Math.round(maxPrice * 0.3), label: '잔금' },
        total: maxPrice,
      };
      const rate = maxPrice <= 60000 ? 0.011 : maxPrice <= 90000 ? 0.022 : 0.033;
      ud.acquisition_tax_estimate = Math.round(maxPrice * rate);
    }
  }
  // 주차비율
  if (parsed.parking_total && totSupply && totSupply > 0 && !parsed.parking_ratio) {
    ud.parking_ratio = parseFloat((parsed.parking_total / totSupply).toFixed(2));
  }
  return ud;
}
