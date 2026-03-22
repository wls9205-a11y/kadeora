import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * 전국 재개발·재건축 정비사업 수집 크론
 * 소스: data.go.kr 국토교통부 정비사업현황조회서비스
 * 서울/경기/부산은 기존 크론에서 수집 → 이 크론은 나머지 지역 담당
 * - 대구, 인천, 광주, 대전, 울산, 세종
 * - 충북, 충남, 전북, 전남, 경북, 경남, 강원, 제주
 */

const REGIONS: Record<string, string> = {
  '대구': '27', '인천': '28', '광주': '29', '대전': '30',
  '울산': '31', '세종': '36',
  '강원': '42', '충북': '43', '충남': '44',
  '전북': '45', '전남': '46', '경북': '47', '경남': '48', '제주': '50',
};

function guessStage(step: string | null): string {
  if (!step) return '조사 중';
  const s = step.trim();
  if (/준공|완료|입주/.test(s)) return '준공';
  if (/착공|공사/.test(s)) return '착공';
  if (/관리처분/.test(s)) return '관리처분';
  if (/사업시행|시행인가/.test(s)) return '사업시행인가';
  if (/조합설립/.test(s)) return '조합설립';
  if (/구역지정|정비구역/.test(s)) return '정비구역지정';
  return '조사 중';
}

function guessType(name: string | null, type: string | null): string {
  const combined = `${name || ''} ${type || ''}`;
  if (/재건축/.test(combined)) return '재건축';
  if (/재개발|도시환경|주거환경/.test(combined)) return '재개발';
  return '재개발';
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.BUSAN_DATA_API_KEY || process.env.MOLIT_STAT_API_KEY;
  if (!apiKey) return NextResponse.json({ success: true, error: 'API key not set' });

  const result = await withCronLogging('crawl-nationwide-redev', async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    let totalCreated = 0;
    let totalFailed = 0;
    const regionResults: Record<string, number> = {};

    for (const [regionName, regionCode] of Object.entries(REGIONS)) {
      try {
        // 국토교통부 정비사업현황 API
        const url = `https://apis.data.go.kr/1613000/ArchPmsService_v2/getUrbRhbsBuldInfo?serviceKey=${encodeURIComponent(apiKey)}&sigunguCd=${regionCode}&numOfRows=500&pageNo=1&resultType=json`;
        
        const res = await fetch(url);
        if (!res.ok) {
          // 대안 API 시도: 정비사업통합정보 
          const altUrl = `https://apis.data.go.kr/1613000/MntncBizInfo/getMntncBizList?serviceKey=${encodeURIComponent(apiKey)}&ctprvnCd=${regionCode}&numOfRows=500&pageNo=1&resultType=json`;
          const altRes = await fetch(altUrl);
          if (!altRes.ok) { totalFailed++; continue; }
          const altData = await altRes.json();
          const altItems = altData?.response?.body?.items?.item || [];
          
          if (Array.isArray(altItems) && altItems.length > 0) {
            const rows = altItems.map((item: any) => ({
              district_name: item.bsnNm || item.pjtNm || item.distNm || '미상',
              region: regionName,
              sigungu: item.sigunguNm || item.sggNm || '',
              address: item.lctnRoadNmAdres || item.lctnLnmAdres || item.adres || '',
              project_type: guessType(item.bsnNm || item.pjtNm, item.bsnTpNm || item.pjtTpNm),
              stage: guessStage(item.stepNm || item.sttusNm || item.prgrsStepNm),
              total_households: parseInt(item.totHshldCo || item.totPltaAr || '0') || null,
              constructor: item.cstrtrNm || item.cnstctrNm || null,
              expected_completion: item.expectCmpltYm || item.cmpltSchdlYm || null,
              notes: item.rm || item.etc || null,
              source: 'data_go_kr',
              is_active: true,
            })).filter((r: any) => r.district_name !== '미상' || r.address);

            if (rows.length > 0) {
              // 지역+구역명 기준 upsert (중복 방지)
              for (const row of rows) {
                const { error } = await supabase
                  .from('redevelopment_projects')
                  .upsert(row, { 
                    onConflict: 'district_name,region',
                    ignoreDuplicates: true 
                  });
                if (!error) totalCreated++;
              }
              regionResults[regionName] = rows.length;
            }
          }
          continue;
        }

        const data = await res.json();
        const items = data?.response?.body?.items?.item || [];
        
        if (!Array.isArray(items) || items.length === 0) {
          regionResults[regionName] = 0;
          continue;
        }

        const rows = items.map((item: any) => ({
          district_name: item.bsnNm || item.distNm || item.pjtNm || '미상',
          region: regionName,
          sigungu: item.sigunguNm || item.sggNm || '',
          address: item.platPlcAdres || item.adres || item.lctnRoadNmAdres || '',
          project_type: guessType(item.bsnNm, item.bsnTpNm || item.pjtTpNm),
          stage: guessStage(item.stepNm || item.sttusNm),
          total_households: parseInt(item.totHshldCo || '0') || null,
          constructor: item.cstrtrNm || null,
          area_sqm: parseFloat(item.totPltaAr || '0') || null,
          expected_completion: item.expectCmpltYm || null,
          notes: item.rm || null,
          source: 'data_go_kr',
          is_active: true,
        })).filter((r: any) => r.district_name !== '미상' || r.address);

        for (const row of rows) {
          const { error } = await supabase
            .from('redevelopment_projects')
            .upsert(row, {
              onConflict: 'district_name,region',
              ignoreDuplicates: true
            });
          if (!error) totalCreated++;
        }
        regionResults[regionName] = rows.length;

      } catch {
        totalFailed++;
        regionResults[regionName] = -1;
      }
    }

    return {
      processed: Object.values(regionResults).filter(v => v > 0).reduce((a, b) => a + b, 0),
      created: totalCreated,
      failed: totalFailed,
      metadata: {
        api_name: 'data_go_kr_redev',
        regions: regionResults,
        regions_covered: Object.keys(REGIONS).length,
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ success: true, error: result.error });
  }
  return NextResponse.json({ ok: true, ...result });
}
