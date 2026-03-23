import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('invest-calendar-refresh', async () => {
    const supabase = getSupabaseAdmin();

    // 1. 과거 이벤트 정리 (30일 이전)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await supabase.from('invest_calendar').delete().lt('event_date', thirtyDaysAgo);

    // 2. 향후 이벤트 카운트
    const today = new Date().toISOString().slice(0, 10);
    const threeMonths = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const { count } = await supabase.from('invest_calendar')
      .select('id', { count: 'exact', head: true })
      .gte('event_date', today);

    let created = 0;

    // 향후 이벤트가 5개 미만이면 AI로 보충
    if ((count || 0) < 5 && process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `오늘은 ${today}입니다. 향후 3개월 (${today} ~ ${threeMonths}) 동안 한국과 미국의 주요 투자 일정을 생성하세요.

포함 항목: FOMC 회의, 한은 금통위, 주요 대기업 실적발표 (삼성전자, SK하이닉스, 현대차, LG에너지솔루션 등), 미국 고용지표/CPI, 선물옵션 만기일, 주요 IPO, 정책 시행일

JSON 배열만 응답. 각 항목: {"title":"이벤트명","description":"설명(30자이내)","event_date":"YYYY-MM-DD","event_type":"monetary|earnings|economy|market|ipo|policy","importance":"high|medium","country":"KR|US|JP"}

최소 15개, 최대 25개. JSON 배열만 출력.`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.content?.[0]?.text || '';
          const match = text.match(/\[[\s\S]*\]/);
          if (match) {
            const events = JSON.parse(match[0]);
            for (const ev of events) {
              if (!ev.title || !ev.event_date) continue;
              const { data: dup } = await supabase.from('invest_calendar')
                .select('id').eq('title', ev.title).eq('event_date', ev.event_date).maybeSingle();
              if (dup) continue;

              const { error } = await supabase.from('invest_calendar').insert({
                title: ev.title,
                description: ev.description || '',
                event_date: ev.event_date,
                event_type: ev.event_type || 'market',
                importance: ev.importance || 'medium',
                country: ev.country || 'KR',
              });
              if (!error) created++;
            }
          }
        }
      } catch {}
    }

    return { processed: count || 0, created, failed: 0, metadata: { api_name: 'anthropic', api_calls: created > 0 ? 1 : 0 } };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}
