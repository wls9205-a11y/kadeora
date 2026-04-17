export const maxDuration = 120;
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * DART 미분류 공시를 Haiku로 카테고리 분류 + 요약
 * dart-ingest 이후 30분 간격 실행
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('dart-classify', async () => {
    const supabase = getSupabaseAdmin();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { processed: 0, created: 0, failed: 0, metadata: { error: 'ANTHROPIC_API_KEY not set' } };
    }

    // 중요도 7 이상이면서 아직 요약이 없는 공시 가져오기
    const { data: filings } = await (supabase as any).from('dart_filings')
      .select('*')
      .is('summary_ko', null)
      .gte('importance_score', 6)
      .order('filed_at', { ascending: false })
      .limit(10);

    if (!filings?.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_unclassified' } };
    }

    let updated = 0;
    let failed = 0;
    let apiCalls = 0;

    for (const filing of filings) {
      try {
        const prompt = `다음 DART 공시를 한국어로 3~5문장 요약해 주세요. 투자 권유 표현 없이 팩트만 서술하세요.

기업: ${filing.corp_name}
보고서: ${filing.report_nm}
카테고리: ${filing.category}
접수일: ${filing.filed_at}

요약만 출력하세요. 다른 텍스트 없이.`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: AI_MODEL_HAIKU,
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        apiCalls++;
        const data = await res.json();
        const summary = data.content?.[0]?.text?.trim() || '';

        if (summary) {
          await (supabase as any).from('dart_filings')
            .update({
              summary_ko: summary,
              processed_at: new Date().toISOString(),
            })
            .eq('id', filing.id);
          updated++;
        } else {
          failed++;
        }
      } catch (e: any) {
        console.error(`[dart-classify] error for ${filing.rcept_no}:`, e.message);
        failed++;
      }
    }

    return {
      processed: filings.length,
      updated,
      failed,
      metadata: { api_name: 'anthropic', api_calls: apiCalls },
    };
  });

  return NextResponse.json(result);
}
