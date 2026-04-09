export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * issue-trend 크론 — 네이버 검색 트렌드 모니터링
 * 급상승 키워드 감지 → 기존 issue_alerts 증폭계수 업데이트
 * 주기: 매 1시간
 */

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

const KEYWORD_GROUPS: Record<string, { groupName: string; keywords: string[] }[]> = {
  apt: [
    { groupName: '청약', keywords: ['무순위 청약', '줍줍', '로또 청약', '청약 경쟁률'] },
    { groupName: '시세', keywords: ['아파트 신고가', '집값', '아파트 시세', '부동산 전망'] },
    { groupName: '전세', keywords: ['전세 사기', '깡통전세', '전세가', '역전세'] },
    { groupName: '정책', keywords: ['부동산 규제', '양도세', '종부세', '대출 규제'] },
    { groupName: '재개발', keywords: ['재건축', '재개발', '관리처분', '조합'] },
  ],
  stock: [
    { groupName: '급등', keywords: ['급등주', '상한가', '테마주', '오늘 급등'] },
    { groupName: '실적', keywords: ['실적 발표', '영업이익', '어닝 서프라이즈'] },
    { groupName: '매크로', keywords: ['기준금리', '금리 인하', '환율', 'FOMC'] },
    { groupName: 'IPO', keywords: ['IPO', '공모주', '상장', '수요예측'] },
    { groupName: '테마', keywords: ['AI 관련주', '반도체', '2차전지', '방산주'] },
  ],
  finance: [
    { groupName: '금리', keywords: ['예금 금리', '적금 금리', '특판 적금', '고금리'] },
    { groupName: '대출', keywords: ['전세대출', '주담대 금리', '신용대출', '디딤돌 대출'] },
    { groupName: '투자', keywords: ['ISA', 'ETF 추천', '배당주 추천', '적립식 투자'] },
    { groupName: '연금', keywords: ['국민연금 수령', '퇴직연금', 'IRP 세액공제'] },
  ],
  tax: [
    { groupName: '부동산세', keywords: ['양도소득세', '종합부동산세', '취득세 계산'] },
    { groupName: '소득세', keywords: ['종합소득세', '연말정산', '소득공제'] },
    { groupName: '상증세', keywords: ['증여세', '상속세', '증여 공제한도'] },
  ],
  economy: [
    { groupName: '금리', keywords: ['한은 금리', '기준금리 인하', '금통위'] },
    { groupName: '환율', keywords: ['원달러 환율', '달러 강세', '엔화 환율'] },
    { groupName: '물가', keywords: ['소비자물가', 'CPI', '인플레이션'] },
  ],
  life: [
    { groupName: '급여', keywords: ['최저시급', '최저임금 인상', '실수령액'] },
    { groupName: '보험', keywords: ['건강보험료', '4대보험', '실손보험'] },
    { groupName: '자동차', keywords: ['자동차세', '전기차 보조금', '하이브리드'] },
  ],
};

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  if (!NAVER_CLIENT_ID) {
  

  return NextResponse.json({ error: 'NAVER_CLIENT_ID not set', checked: 0 });
  }

  const spikeKeywords: { group: string; keyword: string; ratio: number; category: string }[] = [];

  // 네이버 검색어 트렌드 API 호출
  for (const [category, groups] of Object.entries(KEYWORD_GROUPS)) {
    for (const group of groups) {
      try {
        const endDate = new Date().toISOString().slice(0, 10);
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Naver-Client-Id': NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
          },
          body: JSON.stringify({
            startDate, endDate, timeUnit: 'date',
            keywordGroups: [{ groupName: group.groupName, keywords: group.keywords }],
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const results = data.results?.[0]?.data || [];

        if (results.length >= 2) {
          const today = results[results.length - 1]?.ratio || 0;
          const yesterday = results[results.length - 2]?.ratio || 1;
          const ratio = yesterday > 0 ? (today / yesterday) * 100 : 0;

          if (ratio >= 200) { // 전일 대비 200%+
            spikeKeywords.push({
              group: group.groupName,
              keyword: group.keywords[0],
              ratio: Math.round(ratio),
              category,
            });
          }
        }
      } catch {}
    }
  }


  // v2: Google Trends RSS 교차 검증
  let googleTrendingKeywords: string[] = [];
  try {
    const gRes = await fetch('https://trends.google.co.kr/trending/rss?geo=KR', { signal: AbortSignal.timeout(8000) });
    if (gRes.ok) {
      const gXml = await gRes.text();
      const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g;
      let gm;
      while ((gm = titleRegex.exec(gXml)) !== null) {
        const t = gm[1].trim();
        if (t && !t.includes('Google') && !t.includes('트렌드')) googleTrendingKeywords.push(t);
      }
    }
  } catch {}

  // Google 급상승과 네이버 스파이크 교차 체크
  for (const spike of spikeKeywords) {
    const isGoogleToo = googleTrendingKeywords.some(gt =>
      gt.includes(spike.keyword) || spike.keyword.includes(gt) ||
      spike.group.split('').some(ch => gt.includes(ch))
    );
    if (isGoogleToo) {
      spike.ratio = Math.min(spike.ratio * 1.5, 999);
      (spike as any).portal_cross = true;
    }
  }


  // v2: 다음/카카오 뉴스 검색 교차 검증
  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || '';
  let daumTrendingKeywords: string[] = [];
  if (KAKAO_KEY) {
    try {
      // 스파이크 키워드로 다음 웹 검색 → 최근 1시간 내 결과 있으면 트렌딩
      for (const spike of spikeKeywords.slice(0, 5)) {
        const dRes = await fetch(
          `https://dapi.kakao.com/v2/search/web?query=${encodeURIComponent(spike.keyword)}&size=3&sort=recency`,
          { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }, signal: AbortSignal.timeout(5000) }
        );
        if (dRes.ok) {
          const dData = await dRes.json();
          const recentCount = (dData.documents || []).filter((d: any) => {
            const dt = new Date(d.datetime).getTime();
            return dt > Date.now() - 3 * 60 * 60 * 1000; // 3시간 이내
          }).length;
          if (recentCount >= 2) {
            daumTrendingKeywords.push(spike.keyword);
            // portal_cross_count 증가
            const portalCross = ((spike as any).portal_cross ? 2 : 1) + 1;
            (spike as any).portal_cross = true;
            (spike as any).portal_cross_count = portalCross;
          }
        }
      }
    } catch {}
  }

  // 급상승 키워드와 기존 issue_alerts 매칭 → 증폭계수 업데이트
  let updated = 0;
  for (const spike of spikeKeywords) {
    // 24시간 내 관련 이슈 찾기
    const { data: issues } = await (sb as any).from('issue_alerts')
      .select('id, final_score, base_score, multiplier, raw_data')
      .eq('category', spike.category)
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('is_processed', false);

    if (issues && issues.length > 0) {
      for (const issue of issues) {
        const rawData = { ...(issue.raw_data || {}), search_spike: spike.ratio };
        // 증폭계수 재계산
        let newMultiplier = issue.multiplier;
        if (spike.ratio >= 500) newMultiplier = Math.min(newMultiplier * 1.4, 2.0);
        else if (spike.ratio >= 200) newMultiplier = Math.min(newMultiplier * 1.2, 2.0);

        const portalCross = (spike as any).portal_cross ? 2 : 1;
        const newScore = Math.min(Math.round(issue.base_score * newMultiplier), 100);
        const shouldAutoPublish = newScore >= 60;

        await (sb as any).from('issue_alerts').update({
          raw_data: { ...rawData, portal_cross_count: portalCross },
          multiplier: Math.round(newMultiplier * 100) / 100,
          final_score: newScore,
          is_auto_publish: shouldAutoPublish,
        }).eq('id', issue.id);

        updated++;
      }
    }
  }

  return NextResponse.json({
    spikes: spikeKeywords.length,
    spike_details: spikeKeywords,
    updated_issues: updated,
    google_trends: googleTrendingKeywords.length,
    daum_trends: daumTrendingKeywords.length,
  });
}

export const GET = withCronAuth(handler);
