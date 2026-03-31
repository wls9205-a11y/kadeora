import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;

/**
 * 임시 배치 재파싱 API — 100건씩 처리
 * GET /api/admin/batch-reparse?token=CRON_SECRET
 * 배포 후 반복 호출하여 전체 재파싱 완료, 완료 후 삭제
 */
export async function GET(req: NextRequest) {
  // 임시 1회용 토큰 — 재파싱 완료 후 이 파일 삭제
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.CRON_SECRET && token !== 'kd-reparse-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: targets } = await (sb as any).from('apt_subscriptions')
    .select('id, house_manage_no, pblanc_url, house_nm, region_nm, tot_supply_hshld_co, supply_count, constructor_nm')
    .is('announcement_parsed_at', null)
    .not('pblanc_url', 'is', null)
    .neq('pblanc_url', '')
    .order('rcept_bgnde', { ascending: false })
    .limit(100);

  if (!targets?.length) return NextResponse.json({ ok: true, message: '재파싱 완료!', remaining: 0 });

  const { count: remaining } = await (sb as any).from('apt_subscriptions')
    .select('id', { count: 'exact', head: true })
    .is('announcement_parsed_at', null)
    .not('pblanc_url', 'is', null);

  const num = (s: string | undefined): number | null => {
    if (!s) return null;
    const n = parseInt(s.replace(/[^0-9]/g, ''));
    return isNaN(n) ? null : n;
  };
  const strip = (s: string): string => s.replace(/<[^>]+>/g, '').trim();

  let processed = 0, failed = 0;

  for (const apt of targets) {
    try {
      const res = await fetch(apt.pblanc_url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      });
      if (!res.ok) { failed++; await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id); continue; }

      const html = await res.text();
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const ud: Record<string, any> = { announcement_parsed_at: new Date().toISOString() };

      // 건물 스펙
      const totalHH = text.match(/총\s*세대수?\s*[:\s]*([0-9,]+)\s*세대/i) || text.match(/(\d{2,5})\s*세대\s*규모/i);
      if (totalHH) ud.total_households = num(totalHH[1]);
      const dongM = text.match(/(\d{1,3})\s*개?\s*동\s*[\(（]/i) || text.match(/총\s*(\d{1,3})\s*개?\s*동/i);
      if (dongM) { const v = num(dongM[1]); if (v && v <= 200) ud.total_dong_count = v; }
      const flM = text.match(/지상\s*(\d{1,3})\s*층/i);
      if (flM) ud.max_floor = num(flM[1]);
      const minFl = text.match(/지하\s*(\d{1,2})\s*층/i);
      if (minFl) ud.min_floor = num(minFl[1]);
      const parkM = text.match(/주차\s*대수?\s*[:\s]*([0-9,]+)\s*대/i) || text.match(/총\s*주차\s*[:\s]*([0-9,]+)/i);
      if (parkM) ud.parking_total = num(parkM[1]);
      const heatM = text.match(/(개별난방|중앙난방|지역난방)\s*[\(（]?\s*(도시가스|LNG|심야전기|열병합)?/i);
      if (heatM) ud.heating_type = [heatM[1], heatM[2]].filter(Boolean).join(' ');
      const structM = text.match(/(철근콘크리트|RC|벽식|라멘|무량판|철골)/i);
      if (structM) ud.structure_type = structM[1];
      const extM = text.match(/외장재?\s*[:\s]*([\w가-힣\+·]+(?:타일|석|비트|도장|패널|커튼월)[\w가-힣\+·]*)/i);
      if (extM) ud.exterior_finish = extM[1].slice(0, 50);

      // 면적
      const landM = text.match(/대지\s*면적?\s*[:\s]*([\d,.]+)\s*㎡/i);
      if (landM) ud.land_area = parseFloat(landM[1].replace(/,/g, ''));
      const bldgM = text.match(/건축\s*면적?\s*[:\s]*([\d,.]+)\s*㎡/i);
      if (bldgM) ud.building_area = parseFloat(bldgM[1].replace(/,/g, ''));
      const farM = text.match(/용적률?\s*[:\s]*([\d.]+)\s*%/i);
      if (farM) ud.floor_area_ratio = parseFloat(farM[1]);
      const bcrM = text.match(/건폐율?\s*[:\s]*([\d.]+)\s*%/i);
      if (bcrM) ud.building_coverage = parseFloat(bcrM[1]);

      // 금융
      if (/발코니\s*확장/i.test(text)) {
        ud.balcony_extension = true;
        const ec = text.match(/발코니\s*확장\s*비?\s*[:\s]*([\d,]+)\s*만?\s*원?/i);
        if (ec) ud.balcony_extension_cost = num(ec[1]);
      }
      if (/중도금\s*(?:대출\s*)?무이자/i.test(text)) { ud.loan_available = true; ud.loan_rate = '무이자'; }
      else if (/중도금\s*(?:대출\s*)?유이자|이자\s*후불/i.test(text)) {
        ud.loan_available = true;
        const rm = text.match(/연\s*([\d.]+)\s*%/i);
        ud.loan_rate = rm ? `유이자 연 ${rm[1]}%` : '유이자';
      } else if (/중도금\s*대출/i.test(text)) { ud.loan_available = true; }

      // 규제
      const tfM = text.match(/전매\s*(?:행위)?\s*제한\s*기간?\s*[:\s]*([\w가-힣\s]+?)(?:\.|,|$)/i);
      if (tfM) { ud.transfer_limit = tfM[1].trim().slice(0, 80); const m = text.match(/전매\s*제한\s*(\d+)\s*(?:개월|월)/i); if (m) ud.resale_restriction_months = num(m[1]); }
      const resM = text.match(/거주\s*의무\s*기간?\s*[:\s]*([\w가-힣\s]+?)(?:\.|,|$)/i);
      if (resM) { ud.residence_obligation = resM[1].trim().slice(0, 80); const y = text.match(/거주\s*의무\s*(\d+)\s*년/i); if (y) ud.residence_obligation_years = num(y[1]); }
      const savM = text.match(/(?:청약)?저축\s*가입\s*기간?\s*[:\s]*(\d+)\s*(?:개월|월)/i);
      if (savM) ud.savings_requirement = `가입 ${savM[1]}개월 이상`;
      const priM = text.match(/(?:1순위|우선)\s*(?:공급)?\s*(?:지역|대상)\s*[:\s]*([\w가-힣\s·,]+?)(?:\.|<|$)/i);
      if (priM) ud.priority_supply_area = priM[1].trim().slice(0, 100);

      // 시설
      const modelM = text.match(/견본\s*주택\s*(?:위치|주소|장소)\s*[:\s]*([\w가-힣\d\s\-·,]+?)(?:전화|문의|<|$)/i);
      if (modelM) ud.model_house_addr = modelM[1].trim().slice(0, 200);
      const comKw = ['피트니스','헬스','수영장','독서실','어린이집','GX룸','사우나','골프','카페','도서관','경로당','키즈','놀이터','커뮤니티','코인세탁'];
      const found = comKw.filter(k => text.includes(k));
      if (found.length) ud.community_facilities = found;

      // 사업일정
      const appM = text.match(/사업\s*승인\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
      if (appM) ud.business_approval_date = appM[1];
      const stM = text.match(/착공\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
      if (stM) ud.construction_start_date = stM[1];
      const compM = text.match(/(?:준공|사용\s*검사)\s*(?:예정)?\s*일?\s*[:\s]*(\d{4}[-./]\d{1,2}[-./]?\d{0,2})/i);
      if (compM) ud.completion_date = compM[1];

      // 사업유형
      if (/재개발/i.test(text)) ud.project_type = '재개발';
      else if (/재건축/i.test(text)) ud.project_type = '재건축';
      else if (/공공분양|국민임대|행복주택|신혼희망/i.test(text)) ud.project_type = '공공';

      // PDF
      const pdfM = html.match(/href="([^"]*getAtchmnfl[^"]*)"/i);
      if (pdfM) { let u = pdfM[1].replace(/&amp;/g, '&'); if (u.startsWith('/')) u = 'https://www.applyhome.co.kr' + u; ud.announcement_pdf_url = u; }

      // 주차비율
      if (ud.parking_total && apt.tot_supply_hshld_co > 0) ud.parking_ratio = parseFloat((ud.parking_total / apt.tot_supply_hshld_co).toFixed(2));

      await (sb as any).from('apt_subscriptions').update(ud).eq('id', apt.id);
      processed++;
    } catch {
      failed++;
      await (sb as any).from('apt_subscriptions').update({ announcement_parsed_at: new Date().toISOString() }).eq('id', apt.id);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({ ok: true, processed, failed, batch: targets.length, remaining: (remaining || 0) - targets.length });
}
