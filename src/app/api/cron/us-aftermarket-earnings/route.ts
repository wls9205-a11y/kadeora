export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { AI_MODEL_SONNET, ANTHROPIC_VERSION } from '@/lib/constants';
import { sanitizeAiContent, ensureDisclaimer } from '@/lib/ai/sanitize-investment-content';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('us-aftermarket-earnings', async () => {
    const supabase = getSupabaseAdmin();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { processed: 0, created: 0, failed: 0, metadata: { error: 'no_api_key' } };

    // 오늘 실적 발표 예정 종목 조회
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const { data: events } = await (supabase as any).from('earnings_events')
      .select('*')
      .eq('market', 'US')
      .gte('scheduled_at', today)
      .lt('scheduled_at', today + 'T23:59:59')
      .eq('status', 'scheduled')
      .limit(10);

    if (!events?.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_earnings_today' } };
    }

    let created = 0;
    let apiCalls = 0;

    for (const event of events) {
      try {
        const prompt = `미국 기업 실적 발표 요약을 작성하세요.
기업: ${event.symbol}
분기: ${event.period}
매출 실적: ${event.revenue_actual ? `$${(event.revenue_actual / 1e9).toFixed(2)}B` : '미발표'}
매출 컨센서스: ${event.revenue_consensus ? `$${(event.revenue_consensus / 1e9).toFixed(2)}B` : '정보 없음'}
EPS 실적: ${event.eps_actual ?? '미발표'}
EPS 컨센서스: ${event.eps_consensus ?? '정보 없음'}

투자 권유 없이 팩트 기반으로 800자 내외 작성. h2 소제목 3개.`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: AI_MODEL_SONNET,
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        apiCalls++;
        const data = await res.json();
        const raw = data.content?.[0]?.text?.trim() || '';
        if (!raw) continue;

        const { text: sanitized } = sanitizeAiContent(raw);
        const content = ensureDisclaimer(sanitized);

        const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
        const slug = `us-earnings-${event.symbol}-${(event.period || '').replace(/\s/g, '')}-${today.replace(/-/g, '')}`;
        await safeBlogInsert(supabase, {
          slug,
          title: `${event.symbol} ${event.period} 실적 발표 — 한국어 요약`,
          content,
          category: 'stock',
          tags: [event.symbol, '실적발표', '해외주식', '어닝시즌'],
          source_type: 'auto',
          source_ref: event.symbol,
          data_date: today,
          cover_image: `/api/og?title=${encodeURIComponent(`${event.symbol} 실적 발표`)}&category=stock&design=2`,
        });

        // earnings_events 상태 업데이트
        await (supabase as any).from('earnings_events')
          .update({ status: 'analyzed', summary_ko: content.slice(0, 500) })
          .eq('id', event.id);

        created++;
      } catch (e: any) {
        console.error(`[us-aftermarket-earnings] ${event.symbol}:`, e.message);
      }
    }

    return { processed: events.length, created, failed: events.length - created, metadata: { api_name: 'anthropic', api_calls: apiCalls } };
  });
  return NextResponse.json({ success: true, ...result });
}
