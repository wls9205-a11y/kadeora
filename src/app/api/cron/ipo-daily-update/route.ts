export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { sanitizeAiContent, ensureDisclaimer } from '@/lib/ai/sanitize-investment-content';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

/**
 * IPO/공모주 일일 업데이트 크론
 * 
 * 1. DART에서 증권신고서 감지 → ipo_events 테이블 업데이트
 * 2. 청약일 D-1 프리뷰 블로그 자동 발행
 * 3. 상장일 마감 후 성과 분석
 * 
 * 매일 09:00 KST 실행
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('ipo-daily-update', async () => {
    const supabase = getSupabaseAdmin();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 9 * 3600000 + 86400000).toISOString().slice(0, 10);

    let created = 0;
    let apiCalls = 0;

    // ── 1. DART에서 새로운 증권신고서 감지 → IPO 이벤트 생성 ──
    const { data: dartIpo } = await (supabase as any).from('dart_filings')
      .select('*')
      .eq('category', '증권신고')
      .is('processed_at', null)
      .order('filed_at', { ascending: false })
      .limit(5);

    for (const filing of dartIpo || []) {
      // 이미 ipo_events에 있는지 확인
      const { data: existing } = await (supabase as any).from('ipo_events')
        .select('id')
        .eq('company_name', filing.corp_name)
        .limit(1);

      if (!existing?.length) {
        await (supabase as any).from('ipo_events').insert({
          company_name: filing.corp_name,
          status: 'upcoming',
          dart_filing_url: filing.original_url,
        });
        created++;
      }

      await (supabase as any).from('dart_filings')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', filing.id);
    }

    // ── 2. 청약일 D-1 프리뷰 블로그 ──
    const { data: tomorrowIpos } = await (supabase as any).from('ipo_events')
      .select('*')
      .eq('subscription_start', tomorrow)
      .eq('status', 'upcoming');

    if (tomorrowIpos?.length && apiKey) {
      for (const ipo of tomorrowIpos) {
        try {
          const prompt = `내일 청약 시작하는 공모주를 소개하세요.

기업: ${ipo.company_name}
청약 기간: ${ipo.subscription_start} ~ ${ipo.subscription_end}
공모가 밴드: ${ipo.band_low ? `${ipo.band_low}원 ~ ${ipo.band_high}원` : '미정'}
확정 공모가: ${ipo.final_price ? `${ipo.final_price}원` : '미정'}

작성 규칙:
1. 800~1200자, h2 3~4개
2. 투자 권유 없이 팩트 기반
3. 청약 방법, 일정, 유의사항 포함
4. 의무보유확약 정보 있으면 포함`;

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

          apiCalls++;
          const data = await res.json();
          const raw = data.content?.[0]?.text?.trim() || '';
          if (!raw) continue;

          const { text: sanitized } = sanitizeAiContent(raw);
          const content = ensureDisclaimer(sanitized);

          const slug = `ipo-preview-${ipo.company_name.replace(/[^a-z0-9가-힣]/gi, '-').slice(0, 30)}-${tomorrow.replace(/-/g, '')}`;
          await safeBlogInsert(supabase, {
            slug,
            title: `[공모주] ${ipo.company_name} 청약 프리뷰 — ${tomorrow} 청약 시작`,
            content,
            category: 'stock',
            tags: [ipo.company_name, '공모주', 'IPO', '청약', '상장'],
            source_type: 'auto',
            data_date: tomorrow,
            cover_image: `/api/og?title=${encodeURIComponent(`${ipo.company_name} 공모주 청약`)}&category=stock&design=2`,
          });

          // 상태 업데이트
          await (supabase as any).from('ipo_events')
            .update({ status: 'subscribing' })
            .eq('id', ipo.id);

          created++;
        } catch (e: any) {
          console.error(`[ipo-daily-update] ${ipo.company_name}:`, e.message);
        }
      }
    }

    // ── 3. 상장일 종목 성과 트래킹 ──
    const { data: todayListings } = await (supabase as any).from('ipo_events')
      .select('*')
      .eq('listing_date', today)
      .eq('status', 'subscribing');

    for (const ipo of todayListings || []) {
      if (ipo.symbol) {
        const { data: stock } = await supabase
          .from('stock_quotes')
          .select('price, change_pct')
          .eq('symbol', ipo.symbol)
          .maybeSingle();

        if (stock) {
          await (supabase as any).from('ipo_events')
            .update({
              first_day_close: stock.price,
              first_day_change: Number(stock.change_pct),
              status: 'listed',
            })
            .eq('id', ipo.id);
        }
      }
    }

    return {
      processed: (dartIpo?.length || 0) + (tomorrowIpos?.length || 0) + (todayListings?.length || 0),
      created,
      failed: 0,
      metadata: {
        api_name: apiCalls > 0 ? 'anthropic' : undefined,
        api_calls: apiCalls,
        dart_ipo_detected: dartIpo?.length || 0,
        tomorrow_subscriptions: tomorrowIpos?.length || 0,
        today_listings: todayListings?.length || 0,
      },
    };
  });

  return NextResponse.json({ success: true, ...result });
}
