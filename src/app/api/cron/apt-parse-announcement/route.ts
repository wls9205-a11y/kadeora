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

  // 특이사항 (규제지역)
  const remarkMatch = html.match(/특이사항[\s\S]{0,50}?:[\s]*([\s\S]{0,200}?)(?:<\/li|<\/ul|<br)/i);
  if (remarkMatch) {
    const r = strip(remarkMatch[1]);
    data.is_regulated_area = /청약과열|투기과열|조정대상/.test(r);
    data.regulation_type = r;
  }

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
    .limit(30);

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
