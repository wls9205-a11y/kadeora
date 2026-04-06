import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 300;

async function handler(_req: NextRequest) {
  const admin = getSupabaseAdmin();

  // 분석 텍스트가 없는 인기 현장 5건씩 처리
  const { data: sites } = await (admin as any).from('apt_sites')
    .select('id, slug, name, region, sigungu, dong, address, builder, developer, total_units, built_year, move_in_date, status, price_min, price_max, nearby_station, school_district, description, key_features, nearby_facilities, transit_score, price_comparison, option_costs, extension_cost, payment_schedule')
    .is('analysis_text', null)
    .eq('is_active', true)
    .order('page_views', { ascending: false, nullsFirst: false })
    .limit(5);

  if (!sites || sites.length === 0) {
    return { processed: 0, metadata: { reason: 'all_done' } };
  }

  let processed = 0;
  const errors: string[] = [];

  for (const site of sites) {
    try {
      // 연관 청약 데이터 조회
      const { data: sub } = await admin.from('apt_subscriptions')
        .select('tot_supply_hshld_co, competition_rate_1st, competition_rate_avg, rcept_bgnde, rcept_endde, przwner_presnatn_de, constructor_nm, hssply_adres, is_price_limit, mvn_prearnge_ym, pblanc_url, region_nm')
        .eq('house_manage_no', site.slug?.replace(/\D/g, '') || '')
        .maybeSingle();

      // 실거래 데이터 조회
      const { data: trades } = await admin.from('apt_transactions')
        .select('deal_amount, area_sqm, deal_date, floor')
        .ilike('apt_name', `%${site.name?.replace(/[()（）]/g, '').slice(0, 10)}%`)
        .order('deal_date', { ascending: false })
        .limit(5);

      const prompt = buildAnalysisPrompt(site, sub, trades);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        errors.push(`${site.name}: API ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text || text.length < 500) {
        errors.push(`${site.name}: too_short ${text?.length || 0}`);
        continue;
      }

      await (admin as any).from('apt_sites')
        .update({ analysis_text: text, analysis_generated_at: new Date().toISOString() })
        .eq('id', site.id);

      processed++;
    } catch (e: any) {
      errors.push(`${site.name}: ${e.message?.slice(0, 80)}`);
    }
  }

  return { processed, total: sites.length, errors: errors.length > 0 ? errors : undefined };
}

function buildAnalysisPrompt(site: any, sub: any, trades: any[]): string {
  const name = site.name || '미정';
  const region = site.region || '';
  const sigungu = site.sigungu || '';
  const dong = site.dong || '';
  const builder = site.builder || sub?.constructor_nm || '';
  const totalUnits = site.total_units || sub?.tot_supply_hshld_co || 0;
  const moveIn = site.move_in_date || sub?.mvn_prearnge_ym || '';
  const priceMin = site.price_min ? `${(site.price_min / 10000).toFixed(1)}억` : '';
  const priceMax = site.price_max ? `${(site.price_max / 10000).toFixed(1)}억` : '';
  const station = site.nearby_station || '';
  const school = site.school_district || '';
  const compRate = sub?.competition_rate_1st ? Number(sub.competition_rate_1st) : 0;
  const isPriceLimit = sub?.is_price_limit ? '분양가상한제 적용' : '';
  const facilities = site.nearby_facilities ? JSON.stringify(site.nearby_facilities).slice(0, 500) : '';
  const priceComp = site.price_comparison ? JSON.stringify(site.price_comparison).slice(0, 500) : '';
  const paySchedule = site.payment_schedule ? JSON.stringify(site.payment_schedule).slice(0, 300) : '';
  const optCosts = site.option_costs ? JSON.stringify(site.option_costs).slice(0, 300) : '';
  const extCost = site.extension_cost ? `발코니확장비 ${(site.extension_cost / 10000).toFixed(0)}만원` : '';

  const tradeInfo = trades && trades.length > 0
    ? trades.map((t: any) => `${t.deal_date} ${t.area_sqm}㎡ ${t.floor}층 ${(Number(t.deal_amount) / 10000).toFixed(1)}억`).join(' / ')
    : '';

  return `한국 부동산 전문 분석가로서 "${name}" 현장에 대한 종합 분석 글을 작성하세요.

## 현장 데이터 (실제 DB 기반 — 수치를 정확히 사용하세요)
- 현장명: ${name}
- 위치: ${region} ${sigungu} ${dong} / 주소: ${site.address || ''}
- 시공사: ${builder} / 시행사: ${site.developer || ''}
- 총 세대수: ${totalUnits > 0 ? totalUnits.toLocaleString() + '세대' : '미공개'}
- 입주예정: ${moveIn}
- 분양가: ${priceMin && priceMax ? `${priceMin} ~ ${priceMax}` : priceMin || priceMax || '미공개'} ${isPriceLimit}
- 인근역: ${station || '정보 없음'}
- 학군: ${school || '정보 없음'}
- 교통 점수: ${site.transit_score || '미평가'}/100
${compRate > 0 ? `- 1순위 경쟁률: ${compRate.toFixed(1)}:1` : ''}
${facilities ? `- 주변 시설: ${facilities}` : ''}
${priceComp ? `- 주변 시세 비교: ${priceComp}` : ''}
${tradeInfo ? `- 최근 실거래: ${tradeInfo}` : ''}
${paySchedule ? `- 납부 일정: ${paySchedule}` : ''}
${optCosts ? `- 옵션 비용: ${optCosts}` : ''}
${extCost ? `- ${extCost}` : ''}

## 작성 규칙 (필수)
1. 반드시 2,000자 이상 작성
2. 아래 5개 섹션을 모두 포함 (## 소제목 사용)
3. 위 데이터의 구체적 수치를 반드시 본문에 포함
4. 주관적 투자 분석/의견을 포함 (네이버 D.I.A 적합성)
5. 마크다운 형식, "## 목차" 생성 금지
6. ## 제목 안에 **볼드** 사용 금지
7. FAQ 질문은 ### 사용

## 필수 섹션 구조

## ${name} 입지 분석
(교통 접근성: 인근역 + 거리 + 주요 노선, 도로 여건, 개발 호재)
(학군: 배정 학교, 학군 수준 평가)
(생활 편의: 대형마트, 병원, 공원 등)

## 분양가 분석
(분양가 범위와 평당가 해석)
(주변 시세 대비 분석 — price_comparison 데이터 활용)
(시세차익 전망 또는 적정 가격 판단)

## 청약 전략
(경쟁률 분석 또는 예상)
(유리한 타입/평형 분석)
(가점 커트라인 예측 또는 무순위 전략)

## 입주 준비 가이드
(필요 자금 계산: 계약금 + 중도금 + 잔금)
(취득세, 옵션비, 발코니확장비 안내)
→ 내부 링크: [입주비용 계산하기 →](/calc) [청약 가점 진단 →](/apt/diagnose)

## 자주 묻는 질문
(### Q. 형식으로 5개, 실제 청약자들이 궁금해할 질문)

마지막에 면책 문구 추가: "※ 본 분석은 공공 데이터 기반 자동 생성된 참고 자료이며, 투자 판단은 본인 책임입니다."`;
}

export async function GET(req: NextRequest) {
  return withCronLogging('apt-analysis-gen', req, handler);
}
