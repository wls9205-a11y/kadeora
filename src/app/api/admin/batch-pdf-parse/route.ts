import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

// 단일 PDF 파싱 함수
async function parseSinglePdf(
  apt: { id: number; house_nm: string; announcement_pdf_url: string; tot_supply_hshld_co: number },
  pdfParse: any,
  sb: any
): Promise<{ ok: boolean; fields: number }> {
  const num = (s: string): number | null => { const n = parseInt(s.replace(/[^0-9]/g, '')); return isNaN(n) ? null : n; };

  const res = await fetch(apt.announcement_pdf_url, {
    signal: AbortSignal.timeout(12000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return { ok: false, fields: 0 };

  const buf = Buffer.from(await res.arrayBuffer());
  const pdf = await pdfParse(buf, { max: 8 });
  const text = pdf.text || '';
  if (text.length < 100) return { ok: false, fields: 0 };

  const ud: Record<string, any> = {};
  let f = 0;

  // 총세대수 — 공급세대수와 명확히 구분
  const hhPats = [
    /총\s*세대\s*수\s*[:\s]*([0-9,]+)\s*세대/i,
    /총\s*세대\s*수\s*[:\s]*([0-9,]+)/i,
    /단지\s*(?:전체)?\s*(?:총)?\s*([0-9,]+)\s*세대/i,
    /([0-9,]+)\s*세대\s*규모\s*(?:의|인)?\s*(?:단지|아파트)/i,
  ];
  for (const pat of hhPats) {
    const m = text.match(pat);
    if (m) {
      const idx = text.indexOf(m[0]);
      const before = text.slice(Math.max(0, idx - 20), idx);
      if (!/(?:공급|금회|이번|분양)\s*세대/i.test(before)) {
        const v = num(m[1]);
        if (v && v > 0 && v !== apt.tot_supply_hshld_co && v > (apt.tot_supply_hshld_co || 0)) {
          ud.total_households = v; f++;
        }
        break;
      }
    }
  }

  // 건물 스펙
  const dongM = text.match(/(\d{1,3})\s*개?\s*동[\s\(（,]/i) || text.match(/총\s*(\d{1,3})\s*개?\s*동/i) || text.match(/동\s*수\s*[:\s]*(\d{1,3})/i);
  if (dongM) { const v = num(dongM[1]); if (v && v > 0 && v <= 200) { ud.total_dong_count = v; f++; } }
  const flM = text.match(/지상\s*(\d{1,3})\s*층/i);
  if (flM) { const v = num(flM[1]); if (v && v > 0 && v <= 100) { ud.max_floor = v; f++; } }
  const minFl = text.match(/지하\s*(\d{1,2})\s*층/i);
  if (minFl) { const v = num(minFl[1]); if (v && v > 0) { ud.min_floor = v; f++; } }
  const parkM = text.match(/주차\s*(?:대수|장)?\s*[:\s]*(?:총\s*)?([0-9,]+)\s*대/i) || text.match(/([0-9,]+)\s*대\s*\(\s*세대/i);
  if (parkM) { const v = num(parkM[1]); if (v && v > 0) { ud.parking_total = v; f++; if (apt.tot_supply_hshld_co > 0) ud.parking_ratio = parseFloat((v / apt.tot_supply_hshld_co).toFixed(2)); } }
  const heatM = text.match(/(개별\s*난방|중앙\s*난방|지역\s*난방)\s*[\(（]?\s*(도시가스|LNG|심야전기|열병합|가스)?/i);
  if (heatM) { ud.heating_type = [heatM[1].replace(/\s/g, ''), heatM[2]].filter(Boolean).join(' '); f++; }
  const structM = text.match(/(철근\s*콘크리트|철골\s*철근|철골\s*콘크리트|RC조?|벽식\s*구조|라멘\s*구조|무량판)/i);
  if (structM) { ud.structure_type = structM[1].replace(/\s/g, ''); f++; }
  const extM = text.match(/외[벽장]재?\s*[:\s]*([\w가-힣\+·\s]+?)(?:\n|\.|\d{2,}|㎡|세대)/i);
  if (extM && extM[1].length > 2 && extM[1].length < 60) { ud.exterior_finish = extM[1].trim(); f++; }

  // 면적
  const landM = text.match(/대지\s*면적\s*[:\s]*([\d,]+(?:\.\d+)?)\s*(?:㎡|m²)/i);
  if (landM) { ud.land_area = parseFloat(landM[1].replace(/,/g, '')); f++; }
  const bldgM = text.match(/건축\s*면적\s*[:\s]*([\d,]+(?:\.\d+)?)\s*(?:㎡|m²)/i);
  if (bldgM) { ud.building_area = parseFloat(bldgM[1].replace(/,/g, '')); f++; }
  const farM = text.match(/용적\s*률\s*[:\s]*([\d.]+)\s*%/i);
  if (farM) { ud.floor_area_ratio = parseFloat(farM[1]); f++; }
  const bcrM = text.match(/건폐\s*률\s*[:\s]*([\d.]+)\s*%/i);
  if (bcrM) { ud.building_coverage = parseFloat(bcrM[1]); f++; }

  // 금융
  if (/발코니\s*확장/i.test(text)) { ud.balcony_extension = true; f++; }
  if (/중도금\s*(?:대출\s*)?무이자/i.test(text)) { ud.loan_available = true; ud.loan_rate = '무이자'; f++; }
  else if (/중도금\s*(?:대출\s*)?(?:유이자|이자\s*후불)/i.test(text)) { ud.loan_available = true; const rm = text.match(/(?:연|년)\s*([\d.]+)\s*%/i); ud.loan_rate = rm ? `유이자 연 ${rm[1]}%` : '유이자'; f++; }
  else if (/중도금\s*대출/i.test(text)) { ud.loan_available = true; f++; }

  // 규제
  const tfM = text.match(/전매\s*(?:행위)?\s*제한\s*(?:기간)?\s*[:\s]*([^\n]{5,80})/i);
  if (tfM) { ud.transfer_limit = tfM[1].trim().slice(0, 80); f++; }
  const resM = text.match(/거주\s*의무\s*(?:기간)?\s*[:\s]*([^\n]{3,60})/i);
  if (resM) { ud.residence_obligation = resM[1].trim().slice(0, 80); f++; }

  // 시설
  const comKw = ['피트니스','헬스장','수영장','독서실','어린이집','GX룸','사우나','골프','카페테리아','도서관','경로당','키즈','놀이터','코인세탁','스크린골프'];
  const foundCom = comKw.filter(k => text.includes(k));
  if (foundCom.length) { ud.community_facilities = foundCom; f++; }

  // 사업일정
  const appM = text.match(/사업\s*(?:시행)?\s*승인\s*(?:일|일자)?\s*[:\s]*(\d{4}[\.\-\/]\s*\d{1,2}[\.\-\/]?\s*\d{0,2})/i);
  if (appM) { ud.business_approval_date = appM[1].replace(/\s/g, ''); f++; }
  const compM = text.match(/(?:준공|사용\s*검사|사용\s*승인)\s*(?:예정)?\s*(?:일|일자)?\s*[:\s]*(\d{4}[\.\-\/]\s*\d{1,2}[\.\-\/]?\s*\d{0,2})/i);
  if (compM) { ud.completion_date = compM[1].replace(/\s/g, ''); f++; }

  if (!ud.max_floor) ud.max_floor = 0; // 마킹

  // 납부일정에 loan_rate 반영
  if (ud.loan_rate) {
    const { data: cur } = await (sb as any).from('apt_subscriptions').select('payment_schedule').eq('id', apt.id).single();
    if (cur?.payment_schedule) {
      const ps = typeof cur.payment_schedule === 'string' ? JSON.parse(cur.payment_schedule) : cur.payment_schedule;
      if (ps.interim) { ps.interim.loan = ud.loan_rate; ud.payment_schedule = ps; }
    }
  }

  await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
  return { ok: true, fields: f };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const isAuthed = token === process.env.CRON_SECRET || authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const sb = getSupabaseAdmin();

  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_nm, announcement_pdf_url, tot_supply_hshld_co')
    .not('announcement_pdf_url', 'is', null).neq('announcement_pdf_url', '')
    .is('max_floor', null)
    .order('id', { ascending: false })
    .limit(200);

  if (!targets?.length) return NextResponse.json({ ok: true, message: 'PDF 파싱 완료!', remaining: 0 });

  const { count } = await (sb as any).from('apt_subscriptions')
    .select('id', { count: 'exact', head: true })
    .not('announcement_pdf_url', 'is', null).is('max_floor', null);

  let processed = 0, failed = 0, extracted = 0;

  // 10개씩 병렬 처리
  const CONCURRENCY = 10;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((apt: any) => parseSinglePdf(apt, pdfParse, sb).catch(() => ({ ok: false, fields: 0 })))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) { processed++; if (r.value.fields > 0) extracted++; }
      else { failed++; }
    }
  }

  return NextResponse.json({ ok: true, processed, failed, extracted, batch: targets.length, remaining: (count || 0) - targets.length });
}

// GOD MODE에서 POST로 호출됨
export async function POST(req: NextRequest) { return GET(req); }
