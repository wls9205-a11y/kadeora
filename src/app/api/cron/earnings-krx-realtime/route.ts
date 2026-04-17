export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { AI_MODEL_SONNET, ANTHROPIC_VERSION } from '@/lib/constants';
import { sanitizeAiContent, ensureDisclaimer } from '@/lib/ai/sanitize-investment-content';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

/**
 * 국내 실적 공시 실시간 감지 크론
 * 
 * dart_filings에서 category='실적공시'인 미처리 건을 찾아
 * Sonnet으로 한국어 실적 분석 블로그 자동 발행.
 * 
 * 5~15분 간격 실행 권장 (실적 시즌 1·4·7·10월 집중)
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('earnings-krx-realtime', async () => {
    const supabase = getSupabaseAdmin();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { processed: 0, created: 0, failed: 0, metadata: { error: 'no_api_key' } };
    }

    // 실적 공시 중 아직 블로그 미발행 건
    const { data: filings } = await (supabase as any).from('dart_filings')
      .select('*')
      .eq('category', '실적공시')
      .is('processed_at', null)
      .gte('importance_score', 7)
      .order('filed_at', { ascending: false })
      .limit(5);

    if (!filings?.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_unprocessed_earnings' } };
    }

    let created = 0;
    let apiCalls = 0;

    for (const filing of filings) {
      try {
        // 해당 종목의 주가 정보 가져오기
        const { data: stock } = await supabase
          .from('stock_quotes')
          .select('symbol, name, price, change_pct, market_cap, sector')
          .eq('symbol', filing.symbol)
          .maybeSingle();

        const stockInfo = stock
          ? `종목명: ${stock.name} (${stock.symbol})\n현재가: ${stock.price}원 (${Number(stock.change_pct) > 0 ? '+' : ''}${stock.change_pct}%)\n섹터: ${stock.sector}\n시가총액: ${stock.market_cap}`
          : `종목: ${filing.corp_name} (${filing.symbol || '코드 미상'})`;

        const prompt = `다음 DART 실적 공시를 바탕으로 한국어 실적 분석 글을 작성하세요.

${stockInfo}
공시명: ${filing.report_nm}
카테고리: ${filing.category}
접수일: ${filing.filed_at}
공시 URL: ${filing.original_url}

작성 규칙:
1. 제목 한 줄 (## 없이) + 빈 줄 + 본문 (markdown)
2. 구조: 실적 개요 → 전분기/전년 대비 → 시장 컨센서스 대비 (정보 있으면) → 사업부별 (정보 있으면) → 관전 포인트
3. h2 소제목 4~5개
4. 숫자·팩트 기반, 투자 권유 표현 절대 금지
5. "~할 수 있다", "~가능성" 같은 불확실성 표현 사용
6. 1000~1500자
7. 마지막에 "출처: DART 전자공시시스템" 명시`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: AI_MODEL_SONNET,
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        apiCalls++;
        const data = await res.json();
        const raw = data.content?.[0]?.text?.trim() || '';
        if (!raw) continue;

        const lines = raw.split('\n');
        const title = lines[0].replace(/^#+\s*/, '').trim();
        const body = lines.slice(1).join('\n').trim();

        const { text: sanitized } = sanitizeAiContent(body);
        const content = ensureDisclaimer(sanitized);

        // 블로그 발행
        await safeBlogInsert(supabase, {
          title: `[실적] ${title}`,
          content,
          category: '주식',
          sub_category: '실적발표',
          tags: [
            filing.corp_name,
            filing.symbol,
            '실적발표',
            '어닝시즌',
            stock?.sector || '국내주식',
          ].filter(Boolean),
          author: '카더라 증시팀',
          cover_image: `/api/og?title=${encodeURIComponent(title)}&category=stock&design=7`,
        });

        // earnings_events에도 기록
        await (supabase as any).from('earnings_events').upsert({
          symbol: filing.symbol || filing.corp_code,
          market: 'KRX',
          period: new Date(filing.filed_at).getFullYear() + 'Q' + Math.ceil((new Date(filing.filed_at).getMonth() + 1) / 3),
          actual_at: filing.filed_at,
          status: 'analyzed',
          summary_ko: content.slice(0, 500),
          category: 'krx_dart',
        }, { onConflict: 'symbol,market,period' }).catch(() => {});

        // dart_filings 처리 완료 마킹
        await (supabase as any).from('dart_filings')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', filing.id);

        created++;
      } catch (e: any) {
        console.error(`[earnings-krx-realtime] ${filing.corp_name}:`, e.message);
      }
    }

    return {
      processed: filings.length,
      created,
      failed: filings.length - created,
      metadata: { api_name: 'anthropic', api_calls: apiCalls },
    };
  });

  return NextResponse.json({ success: true, ...result });
}
