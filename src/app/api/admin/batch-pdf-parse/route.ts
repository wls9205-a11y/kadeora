import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * 모집공고 PDF 파싱 배치 — 건물스펙/면적/규제/대출 등 추출
 * GET /api/admin/batch-pdf-parse?token=kd-reparse-2026
 * 
 * 청약홈 HTML에 없고 PDF에만 있는 정보:
 * 동수, 최고층, 주차대수, 난방방식, 구조, 외장재
 * 대지면적, 건축면적, 용적률, 건폐율
 * 전매제한, 거주의무, 대출조건(유이자/무이자)
 * 발코니확장비, 견본주택, 커뮤니티시설
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.CRON_SECRET && token !== 'kd-reparse-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Dynamic import for pdf-parse (Node.js only)
  const pdfParse = (await import('pdf-parse')).default;
  const sb = getSupabaseAdmin();

  // PDF가 있고, 아직 건물스펙이 없는 건
  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_nm, announcement_pdf_url, tot_supply_hshld_co')
    .not('announcement_pdf_url', 'is', null)
    .neq('announcement_pdf_url', '')
    .is('max_floor', null)
    .order('id', { ascending: false })
    .limit(20);

  if (!targets?.length) return NextResponse.json({ ok: true, message: 'PDF 파싱 완료!', remaining: 0 });

  const { count } = await (sb as any).from('apt_subscriptions')
    .select('id', { count: 'exact', head: true })
    .not('announcement_pdf_url', 'is', null).is('max_floor', null);

  const num = (s: string): number | null => { const n = parseInt(s.replace(/[^0-9]/g, '')); return isNaN(n) ? null : n; };

  let processed = 0, failed = 0, extracted = 0;

  for (const apt of targets) {
    try {
      // PDF 다운로드
      const res = await fetch(apt.announcement_pdf_url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) { failed++; continue; }

      const buf = Buffer.from(await res.arrayBuffer());
      let text = '';
      try {
        const pdf = await pdfParse(buf, { max: 10 }); // 최대 10페이지
        text = pdf.text || '';
      } catch { failed++; continue; }

      if (!text || text.length < 100) { failed++; continue; }

      const ud: Record<string, any> = {};
      let fieldsFound = 0;

      // ══════ 건물 스펙 ══════
      const dongM = text.match(/(\d{1,3})\s*개?\s*동[\s\(（,]/i) || text.match(/총\s*(\d{1,3})\s*개?\s*동/i) || text.match(/동\s*수\s*[:\s]*(\d{1,3})/i);
      if (dongM) { const v = num(dongM[1]); if (v && v > 0 && v <= 200) { ud.total_dong_count = v; fieldsFound++; } }

      const flM = text.match(/지상\s*(\d{1,3})\s*층/i);
      if (flM) { const v = num(flM[1]); if (v && v > 0 && v <= 100) { ud.max_floor = v; fieldsFound++; } }
      const minFl = text.match(/지하\s*(\d{1,2})\s*층/i);
      if (minFl) { const v = num(minFl[1]); if (v && v > 0) { ud.min_floor = v; fieldsFound++; } }

      const parkM = text.match(/주차\s*(?:대수|장)?\s*[:\s]*(?:총\s*)?([0-9,]+)\s*대/i) || text.match(/([0-9,]+)\s*대\s*\(\s*세대/i);
      if (parkM) { const v = num(parkM[1]); if (v && v > 0) { ud.parking_total = v; fieldsFound++; if (apt.tot_supply_hshld_co > 0) ud.parking_ratio = parseFloat((v / apt.tot_supply_hshld_co).toFixed(2)); } }

      const heatM = text.match(/(개별\s*난방|중앙\s*난방|지역\s*난방)\s*[\(（]?\s*(도시가스|LNG|심야전기|열병합|가스)?/i);
      if (heatM) { ud.heating_type = [heatM[1].replace(/\s/g, ''), heatM[2]].filter(Boolean).join(' '); fieldsFound++; }

      const structM = text.match(/(철근\s*콘크리트|철골\s*철근|철골\s*콘크리트|RC조?|벽식\s*구조|라멘\s*구조|무량판)/i);
      if (structM) { ud.structure_type = structM[1].replace(/\s/g, ''); fieldsFound++; }

      const extM = text.match(/외[벽장]재?\s*[:\s]*([\w가-힣\+·\s]+?)(?:\n|\.|\d{2,}|㎡|세대)/i);
      if (extM && extM[1].length > 2 && extM[1].length < 60) { ud.exterior_finish = extM[1].trim(); fieldsFound++; }

      // ══════ 면적 ══════
      const landM = text.match(/대지\s*면적\s*[:\s]*([\d,]+(?:\.\d+)?)\s*(?:㎡|m²)/i);
      if (landM) { ud.land_area = parseFloat(landM[1].replace(/,/g, '')); fieldsFound++; }
      const bldgM = text.match(/건축\s*면적\s*[:\s]*([\d,]+(?:\.\d+)?)\s*(?:㎡|m²)/i);
      if (bldgM) { ud.building_area = parseFloat(bldgM[1].replace(/,/g, '')); fieldsFound++; }
      const farM = text.match(/용적\s*률\s*[:\s]*([\d.]+)\s*%/i);
      if (farM) { ud.floor_area_ratio = parseFloat(farM[1]); fieldsFound++; }
      const bcrM = text.match(/건폐\s*률\s*[:\s]*([\d.]+)\s*%/i);
      if (bcrM) { ud.building_coverage = parseFloat(bcrM[1]); fieldsFound++; }

      // ══════ 금융/대출 ══════
      if (/발코니\s*확장/i.test(text)) {
        ud.balcony_extension = true; fieldsFound++;
        const ec = text.match(/발코니\s*확장\s*(?:비|비용|금액)?\s*[:\s]*([\d,]+)\s*(?:만\s*)?원?/i) || text.match(/확장\s*비\s*[:\s]*([\d,]+)/i);
        if (ec) { ud.balcony_extension_cost = num(ec[1]); fieldsFound++; }
      }

      if (/중도금\s*(?:대출\s*)?무이자/i.test(text)) {
        ud.loan_available = true; ud.loan_rate = '무이자'; fieldsFound++;
      } else if (/중도금\s*(?:대출\s*)?(?:유이자|이자\s*후불)/i.test(text)) {
        ud.loan_available = true;
        const rm = text.match(/(?:연|년)\s*([\d.]+)\s*%/i);
        ud.loan_rate = rm ? `유이자 연 ${rm[1]}%` : '유이자'; fieldsFound++;
      } else if (/중도금\s*대출/i.test(text)) {
        ud.loan_available = true; fieldsFound++;
      }

      // ══════ 규제/자격 ══════
      const tfM = text.match(/전매\s*(?:행위)?\s*제한\s*(?:기간)?\s*[:\s]*([^\n]{5,80})/i);
      if (tfM) {
        ud.transfer_limit = tfM[1].trim().slice(0, 80); fieldsFound++;
        const mM = text.match(/전매\s*제한\s*(\d+)\s*(?:개월|월)/i);
        const yM = text.match(/전매\s*제한\s*(\d+)\s*년/i);
        if (mM) ud.resale_restriction_months = num(mM[1]);
        else if (yM) ud.resale_restriction_months = (num(yM[1]) || 0) * 12;
      }

      const resM = text.match(/거주\s*의무\s*(?:기간)?\s*[:\s]*([^\n]{3,60})/i);
      if (resM) {
        ud.residence_obligation = resM[1].trim().slice(0, 80); fieldsFound++;
        const ry = text.match(/(\d+)\s*년\s*(?:이상\s*)?거주\s*의무/i) || text.match(/거주\s*의무\s*(\d+)\s*년/i);
        if (ry) ud.residence_obligation_years = num(ry[1]);
      }

      const savM = text.match(/(?:청약\s*)?(?:주택\s*)?저축\s*(?:가입\s*)?기간\s*[:\s]*(\d+)\s*(?:개월|월)/i);
      if (savM) { ud.savings_requirement = `가입 ${savM[1]}개월 이상`; fieldsFound++; }

      const priM = text.match(/(?:해당\s*)?(?:시|군|구)\s*(?:[\··]\s*)?(?:거주자|주민)\s*(?:우선|1순위)/i);
      if (priM) { ud.priority_supply_area = '해당 시·군·구 거주자'; fieldsFound++; }

      // ══════ 시설 ══════
      const modelM = text.match(/견본\s*주택\s*(?:위치|주소|소재지|장소)\s*[:\s]*([^\n]{5,150})/i);
      if (modelM) { ud.model_house_addr = modelM[1].trim().slice(0, 200); fieldsFound++; }

      const comKw = ['피트니스','헬스장','수영장','독서실','어린이집','GX룸','GX','사우나','골프','카페테리아','도서관','경로당','키즈','놀이터','코인세탁','스크린골프','탁구','입주민라운지','게스트하우스'];
      const foundCom = comKw.filter(k => text.includes(k));
      if (foundCom.length) { ud.community_facilities = foundCom; fieldsFound++; }

      // 사업일정
      const appM = text.match(/사업\s*(?:시행)?\s*승인\s*(?:일|일자)?\s*[:\s]*(\d{4}[\.\-\/]\s*\d{1,2}[\.\-\/]?\s*\d{0,2})/i);
      if (appM) { ud.business_approval_date = appM[1].replace(/\s/g, ''); fieldsFound++; }
      const stM = text.match(/착공\s*(?:일|일자)?\s*[:\s]*(\d{4}[\.\-\/]\s*\d{1,2}[\.\-\/]?\s*\d{0,2})/i);
      if (stM) { ud.construction_start_date = stM[1].replace(/\s/g, ''); fieldsFound++; }
      const compM = text.match(/(?:준공|사용\s*검사|사용\s*승인)\s*(?:예정)?\s*(?:일|일자)?\s*[:\s]*(\d{4}[\.\-\/]\s*\d{1,2}[\.\-\/]?\s*\d{0,2})/i);
      if (compM) { ud.completion_date = compM[1].replace(/\s/g, ''); fieldsFound++; }

      // max_floor가 없으면 0으로 마킹 (중복 처리 방지)
      if (!ud.max_floor) ud.max_floor = 0;

      // 납부일정 업데이트 (loan_rate 반영)
      if (ud.loan_rate) {
        const { data: cur } = await (sb as any).from('apt_subscriptions').select('payment_schedule').eq('id', apt.id).single();
        if (cur?.payment_schedule) {
          const ps = typeof cur.payment_schedule === 'string' ? JSON.parse(cur.payment_schedule) : cur.payment_schedule;
          if (ps.interim) { ps.interim.loan = ud.loan_rate; ud.payment_schedule = ps; }
        }
      }

      if (fieldsFound > 0) extracted++;
      await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
      processed++;
    } catch (e: any) {
      failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({ ok: true, processed, failed, extracted, batch: targets.length, remaining: (count || 0) - targets.length });
}
