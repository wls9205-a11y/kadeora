export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { sanitizeAiContent, ensureDisclaimer } from '@/lib/ai/sanitize-investment-content';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

/**
 * 매크로 경제지표 발표 감지 + 섹터/종목 영향 매핑
 * 
 * FRED API로 주요 미국 경제지표 모니터링:
 * - CPI, PPI, NFP (고용), FOMC, 소매판매, ISM, GDP
 * 
 * 서프라이즈 감지 시 → macro_stock_impact 매트릭스에서
 * 영향 섹터 자동 조회 → 블로그 자동 발행
 * 
 * 매일 20:30 KST 실행 (다음날 매크로 프리뷰)
 */

// 주요 경제 캘린더 이벤트 (수동 스케줄 기반 — Finnhub 캘린더 API 대체 가능)
const MACRO_EVENTS_STATIC = [
  { type: 'FOMC', description_ko: '미국 연방공개시장위원회 (FOMC) 금리 결정', country: 'US' },
  { type: 'CPI', description_ko: '미국 소비자물가지수 (CPI)', country: 'US' },
  { type: 'PPI', description_ko: '미국 생산자물가지수 (PPI)', country: 'US' },
  { type: 'NFP', description_ko: '미국 비농업 고용 (Non-Farm Payrolls)', country: 'US' },
  { type: 'Retail_Sales', description_ko: '미국 소매판매', country: 'US' },
  { type: 'ISM_Manufacturing', description_ko: '미국 ISM 제조업 PMI', country: 'US' },
  { type: 'ISM_Services', description_ko: '미국 ISM 서비스업 PMI', country: 'US' },
  { type: 'GDP', description_ko: '미국 GDP 성장률', country: 'US' },
  { type: 'PCE', description_ko: '미국 개인소비지출 (PCE) 물가', country: 'US' },
  { type: 'Initial_Claims', description_ko: '미국 신규 실업수당 청구건수', country: 'US' },
  { type: 'BOK_Rate', description_ko: '한국은행 기준금리 결정', country: 'KR' },
  { type: 'KR_CPI', description_ko: '한국 소비자물가지수', country: 'KR' },
  { type: 'KR_Export', description_ko: '한국 수출입 동향', country: 'KR' },
];

// 매크로 → 섹터 영향 기본 매트릭스 (초기 시드 데이터)
const DEFAULT_IMPACT_MATRIX: Array<{
  event_type: string;
  surprise_direction: string;
  target_entity_type: string;
  target_entity: string;
  impact_direction: string;
  impact_magnitude: string;
  rationale_ko: string;
}> = [
  // CPI 서프라이즈 (예상보다 높음)
  { event_type: 'CPI', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '금융', impact_direction: 'positive', impact_magnitude: 'moderate', rationale_ko: '금리 인상 기대 → 은행 마진 확대' },
  { event_type: 'CPI', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '기술', impact_direction: 'negative', impact_magnitude: 'strong', rationale_ko: '할인율 상승 → 성장주 밸류에이션 압박' },
  { event_type: 'CPI', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '부동산/리츠', impact_direction: 'negative', impact_magnitude: 'moderate', rationale_ko: '금리 상승 우려 → 리츠 할인율 증가' },
  // FOMC 금리 인상
  { event_type: 'FOMC', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '은행', impact_direction: 'positive', impact_magnitude: 'strong', rationale_ko: '기준금리 인상 → 예대마진 확대' },
  { event_type: 'FOMC', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '반도체', impact_direction: 'negative', impact_magnitude: 'moderate', rationale_ko: '긴축 환경 → 수요 둔화 우려' },
  // NFP 서프라이즈 (고용 강세)
  { event_type: 'NFP', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '소비재', impact_direction: 'positive', impact_magnitude: 'moderate', rationale_ko: '고용 호조 → 소비 지출 증가 기대' },
  { event_type: 'NFP', surprise_direction: 'positive', target_entity_type: 'sector', target_entity: '기술', impact_direction: 'negative', impact_magnitude: 'weak', rationale_ko: '경기 과열 우려 → 긴축 장기화 가능성' },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('macro-event-detect', async () => {
    const supabase = getSupabaseAdmin();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // ── 1. 시드 데이터 확인 및 삽입 ──
    const { data: existingImpact } = await (supabase as any).from('macro_stock_impact')
      .select('id')
      .limit(1);

    if (!existingImpact?.length) {
      // 초기 시드 데이터 삽입
      for (const row of DEFAULT_IMPACT_MATRIX) {
        await (supabase as any).from('macro_stock_impact').insert(row);
      }
    }

    // ── 2. 내일 예정된 매크로 이벤트 프리뷰 블로그 생성 ──
    if (!apiKey) {
      return { processed: 0, created: 0, failed: 0, metadata: { error: 'no_api_key', seed_inserted: !existingImpact?.length } };
    }

    // Finnhub 경제 캘린더 (API 키 있으면 사용)
    const finnhubKey = process.env.FINNHUB_API_KEY;
    let upcomingEvents: string[] = [];

    if (finnhubKey) {
      try {
        const from = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
        const to = new Date(Date.now() + 9 * 3600000 + 7 * 86400000).toISOString().slice(0, 10);
        const res = await fetch(
          `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const data = await res.json();
          const events = data?.economicCalendar || [];
          upcomingEvents = events
            .filter((e: any) => e.impact === 'high')
            .slice(0, 10)
            .map((e: any) => `${e.event} (${e.country}, ${e.time || e.date})`);
        }
      } catch (e: any) {
        console.error('[macro-event-detect] Finnhub error:', e.message);
      }
    }

    // 이벤트 없어도 기본 프리뷰 생성
    const kstDate = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const eventsText = upcomingEvents.length
      ? upcomingEvents.join('\n')
      : '주요 일정: 추후 확인 필요';

    const prompt = `이번 주 예정된 미국·한국 주요 경제지표 발표를 정리하세요.

일정:
${eventsText}

작성 규칙:
1. 제목 한 줄 + 본문 (markdown)
2. 각 이벤트별: 발표 시각(KST) + 컨센서스 + 이전 값 + 시장 영향 예상
3. 투자 권유 표현 절대 금지, "~가능성" 같은 불확실성 표현만 사용
4. 800~1200자, h2 소제목 3~5개`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: AI_MODEL_HAIKU,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const raw = data.content?.[0]?.text?.trim() || '';
      if (!raw) return { processed: 1, created: 0, failed: 1, metadata: { reason: 'ai_empty' } };

      const { text: sanitized } = sanitizeAiContent(raw);
      const content = ensureDisclaimer(sanitized);
      const lines = raw.split('\n');
      const title = lines[0].replace(/^#+\s*/, '').trim() || `이번 주 매크로 일정 — ${kstDate}`;

      await safeBlogInsert(supabase, {
        title: `[매크로] ${title}`,
        content,
        category: '주식',
        sub_category: '매크로',
        tags: ['매크로', '경제지표', 'FOMC', 'CPI', '금리', '미국경제'],
        author: '카더라 증시팀',
        cover_image: `/api/og?title=${encodeURIComponent(title)}&category=stock&design=11`,
      });

      return {
        processed: 1,
        created: 1,
        failed: 0,
        metadata: {
          api_name: 'anthropic',
          api_calls: 1,
          upcoming_events: upcomingEvents.length,
          seed_inserted: !existingImpact?.length,
        },
      };
    } catch (e: any) {
      return { processed: 1, created: 0, failed: 1, metadata: { error: e.message } };
    }
  });

  return NextResponse.json({ success: true, ...result });
}
