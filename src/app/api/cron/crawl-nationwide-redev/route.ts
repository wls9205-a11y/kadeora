import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * 전국 재개발·재건축 정비사업 수집 크론
 * 서울/경기/부산은 기존 전용 크론에서 수집 → 이 크론은 나머지 14개 시도 담당
 * data.go.kr 정비사업정보서비스 (1613000/MntncBizInfoSvc)
 */

// 시도별 주요 시군구 코드 (5자리)
const SIGUNGU_CODES: Record<string, { name: string; codes: Record<string, string> }> = {
  '경기': { name: '경기', codes: {
    '수원시': '41111', '성남시': '41131', '고양시': '41281', '용인시': '41463',
    '화성시': '41590', '남양주시': '41360', '파주시': '41480', '시흥시': '41390',
    '안산시': '41271', '안양시': '41171', '부천시': '41190', '의정부시': '41150',
    '평택시': '41220', '하남시': '41450', '광명시': '41210', '구리시': '41310',
    '오산시': '41370',
  }},
  '대구': { name: '대구', codes: { '중구': '27110', '동구': '27140', '서구': '27170', '남구': '27200', '북구': '27230', '수성구': '27260', '달서구': '27290', '달성군': '27710' } },
  '인천': { name: '인천', codes: { '중구': '28110', '동구': '28140', '미추홀구': '28177', '연수구': '28185', '남동구': '28200', '부평구': '28237', '계양구': '28245', '서구': '28260' } },
  '광주': { name: '광주', codes: { '동구': '29110', '서구': '29140', '남구': '29155', '북구': '29170', '광산구': '29200' } },
  '대전': { name: '대전', codes: { '동구': '30110', '중구': '30140', '서구': '30170', '유성구': '30200', '대덕구': '30230' } },
  '울산': { name: '울산', codes: { '중구': '31110', '남구': '31140', '동구': '31170', '북구': '31200' } },
  '세종': { name: '세종', codes: { '세종시': '36110' } },
  '충남': { name: '충남', codes: { '천안시': '44131', '아산시': '44200', '서산시': '44210', '당진시': '44270' } },
  '충북': { name: '충북', codes: { '청주시': '43111', '충주시': '43130', '제천시': '43150' } },
  '전남': { name: '전남', codes: { '여수시': '46130', '순천시': '46150', '목포시': '46110', '광양시': '46230' } },
  '전북': { name: '전북', codes: { '전주시': '45111', '군산시': '45130', '익산시': '45140' } },
  '경남': { name: '경남', codes: { '창원시': '48121', '김해시': '48250', '양산시': '48330', '거제시': '48310', '진주시': '48170', '통영시': '48220' } },
  '경북': { name: '경북', codes: { '포항시': '47111', '구미시': '47190', '경산시': '47290', '경주시': '47130' } },
  '강원': { name: '강원', codes: { '춘천시': '42110', '원주시': '42130', '강릉시': '42150' } },
  '제주': { name: '제주', codes: { '제주시': '50110', '서귀포시': '50130' } },
};

function guessStage(step: string | null): string {
  if (!step) return '정비구역지정';
  if (/준공|완료|입주/.test(step)) return '준공';
  if (/착공|공사/.test(step)) return '착공';
  if (/관리처분/.test(step)) return '관리처분';
  if (/사업시행|시행인가/.test(step)) return '사업시행인가';
  if (/조합설립/.test(step)) return '조합설립';
  if (/구역지정|정비구역/.test(step)) return '정비구역지정';
  if (/추진위/.test(step)) return '추진위';
  return '정비구역지정';
}

function guessType(text: string | null): string {
  if (!text) return '재개발';
  if (/재건축/.test(text)) return '재건축';
  return '재개발';
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const apiKey = process.env.BUSAN_DATA_API_KEY || process.env.MOLIT_STAT_API_KEY;
  if (!apiKey) return NextResponse.json({ success: true, error: 'API key not set (BUSAN_DATA_API_KEY or MOLIT_STAT_API_KEY)' });

  const result = await withCronLogging('crawl-nationwide-redev', async () => {
    const supabase = getSupabaseAdmin();
    let totalCreated = 0;
    const regionResults: Record<string, number> = {};
    const debugInfo: Record<string, any> = {};

    for (const [regionKey, regionData] of Object.entries(SIGUNGU_CODES)) {
      let regionCount = 0;

      for (const [sigunguName, sigunguCode] of Object.entries(regionData.codes)) {
        try {
          // 정비사업정보서비스 API
          const url = `https://apis.data.go.kr/1613000/MntncBizInfoSvc/getMntncBizList?serviceKey=${encodeURIComponent(apiKey)}&sigunguCd=${sigunguCode}&numOfRows=200&pageNo=1&resultType=json`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          
          if (!res.ok) {
            debugInfo[`${regionKey}_${sigunguName}`] = { status: res.status, statusText: res.statusText };
            continue;
          }

          const data = await res.json();
          const items = data?.response?.body?.items?.item;
          
          if (!items) {
            // 응답 구조 디버그
            const bodyKeys = Object.keys(data?.response?.body || {});
            debugInfo[`${regionKey}_${sigunguName}`] = { 
              bodyKeys, 
              totalCount: data?.response?.body?.totalCount,
              sample: JSON.stringify(data).slice(0, 200) 
            };
            continue;
          }

          const itemList = Array.isArray(items) ? items : [items];
          
          for (const item of itemList) {
            const districtName = item.bsnNm || item.pjtNm || item.mntncInsttNm || '';
            if (!districtName) continue;

            const row = {
              district_name: districtName,
              region: regionKey,
              sigungu: sigunguName,
              address: item.lcRoadNmAdres || item.lcLnmAdres || '',
              project_type: guessType(item.bsnClsfNm || item.pjtTpNm || districtName),
              stage: guessStage(item.prgrsStepNm || item.sttusNm || ''),
              total_households: parseInt(item.totHshldCo || '0') || null,
              constructor: item.cstrtrNm || null,
              notes: item.rm || null,
              source: 'data_go_kr_nationwide',
              is_active: true,
            };

            const { error } = await supabase
              .from('redevelopment_projects')
              .upsert(row, { onConflict: 'district_name,region' });
            if (!error) totalCreated++;
          }

          regionCount += itemList.length;
        } catch (e: unknown) {
          debugInfo[`${regionKey}_${sigunguName}`] = { error: errMsg(e) };
        }
      }

      regionResults[regionKey] = regionCount;
    }

    return {
      processed: Object.values(regionResults).reduce((a, b) => a + b, 0),
      created: totalCreated,
      failed: 0,
      metadata: { api_name: 'data_go_kr_MntncBizInfoSvc', regions: regionResults, debug: debugInfo },
    };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
