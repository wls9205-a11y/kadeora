import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'kd-reparse-2026') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = 'https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2021000870&pblancNo=2021000870';
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  const html = await res.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Test each regex
  const tests: Record<string, any> = {};
  tests.html_length = html.length;
  tests.text_length = text.length;
  tests.has_table = (html.match(/<table/gi) || []).length;

  // Supply target table
  const supplyTbl = html.match(/공급대상[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  tests.supply_table_found = !!supplyTbl;
  if (supplyTbl) tests.supply_table_preview = supplyTbl[1].slice(0, 300);

  // Special supply table
  const specTbl = html.match(/특별공급\s*공급대상[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  tests.special_table_found = !!specTbl;
  if (specTbl) tests.special_table_preview = specTbl[1].slice(0, 300);

  // Price table
  const priceTbl = html.match(/공급금액[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  tests.price_table_found = !!priceTbl;

  // 특이사항
  const remarkMatch = html.match(/특이사항[\s\S]{0,50}?:[\s]*([\s\S]{0,200}?)(?:<\/li|<\/ul|<br)/i);
  tests.remark_found = !!remarkMatch;
  if (remarkMatch) tests.remark_text = remarkMatch[1].replace(/<[^>]+>/g, '').trim();

  // 입주예정
  const mvMatch = html.match(/입주예정월\s*[:\s]*([0-9]{4}[.\-/]?[0-9]{1,2})/i);
  tests.move_in_found = !!mvMatch;
  if (mvMatch) tests.move_in_value = mvMatch[1];

  // Text-based: 총세대수, 동수, 층수, 주차 etc.
  tests.text_총세대 = (text.match(/총\s*세대수?\s*[:\s]*([0-9,]+)\s*세대/i) || [null])[0];
  tests.text_동 = (text.match(/(\d{1,3})\s*개?\s*동\s*[\(（]/i) || text.match(/총\s*(\d{1,3})\s*개?\s*동/i) || [null])[0];
  tests.text_층 = (text.match(/지상\s*(\d{1,3})\s*층/i) || [null])[0];
  tests.text_주차 = (text.match(/주차\s*대수?\s*[:\s]*([0-9,]+)\s*대/i) || [null])[0];
  tests.text_난방 = (text.match(/(개별난방|중앙난방|지역난방)/i) || [null])[0];
  tests.text_중도금 = (text.match(/중도금\s*(?:대출\s*)?(?:무이자|유이자)/i) || [null])[0];
  tests.text_발코니 = (text.match(/발코니\s*확장/i) || [null])[0];
  tests.text_전매 = (text.match(/전매\s*(?:행위)?\s*제한/i) || [null])[0];
  tests.text_거주의무 = (text.match(/거주\s*의무/i) || [null])[0];
  tests.text_견본주택 = (text.match(/견본\s*주택/i) || [null])[0];
  tests.text_피트니스 = text.includes('피트니스');
  tests.text_커뮤니티 = text.includes('커뮤니티');

  // 기타사항 테이블
  const etcTbl = html.match(/기타사항[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  tests.etc_table_found = !!etcTbl;
  if (etcTbl) tests.etc_table_preview = etcTbl[1].replace(/<[^>]+>/g, ' ').trim().slice(0, 200);

  // PDF
  const pdfMatch = html.match(/href="([^"]*getAtchmnfl[^"]*)"/i);
  tests.pdf_found = !!pdfMatch;
  if (pdfMatch) tests.pdf_url = pdfMatch[1].replace(/&amp;/g, '&').slice(0, 200);

  // 공급규모
  const scaleMatch = html.match(/공급규모[\s\S]{0,200}?<td[^>]*>([\s\S]*?)<\/td>/i);
  tests.scale_found = !!scaleMatch;
  if (scaleMatch) tests.scale_value = scaleMatch[1].replace(/<[^>]+>/g, '').trim();

  // Text snippet around key words
  const idx = text.indexOf('특이사항');
  if (idx >= 0) tests.text_around_특이사항 = text.slice(idx, idx + 200);

  return NextResponse.json(tests);
}
