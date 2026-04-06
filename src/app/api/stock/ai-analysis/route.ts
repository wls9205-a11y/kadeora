export const maxDuration = 30;
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * 프로 회원 전용 AI 종목 분석
 * POST /api/stock/ai-analysis
 * body: { symbol: string }
 * 
 * - 프로 멤버십 회원만 사용 가능
 * - 주간 5건 제한 (ai_analysis_weekly)
 * - Haiku 4.5로 비용 효율적 분석
 * - 결과 24시간 캐싱 (같은 종목 재분석 방지)
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(req);
  if (!rl) return rateLimitResponse();

  try {
    const { symbol } = await req.json();
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: '종목 코드가 필요합니다' }, { status: 400 });
    }

    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: '유효하지 않은 인증' }, { status: 401 });

    // 프로 회원 확인
    const { data: profile } = await supabase.from('profiles')
      .select('is_premium, premium_expires_at')
      .eq('id', user.id).single();

    if (!profile?.is_premium || (profile.premium_expires_at && new Date(profile.premium_expires_at) < new Date())) {
      return NextResponse.json({ error: '프로 멤버십 전용 기능입니다', upgrade: true }, { status: 403 });
    }

    // 주간 사용량 확인 (이번 주 월~일)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const { count } = await (supabase as any).from('stock_ai_analysis')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monday.toISOString());

    if ((count ?? 0) >= 5) {
      return NextResponse.json({
        error: '이번 주 AI 분석 한도(5건)를 초과했습니다',
        remaining: 0,
        reset: getNextMonday(),
      }, { status: 429 });
    }

    // 24시간 캐시 확인 (같은 종목)
    const cacheKey = `${symbol}_${now.toISOString().slice(0, 10)}`;
    const { data: cached } = await (supabase as any).from('stock_ai_analysis')
      .select('id, analysis, created_at')
      .eq('symbol', symbol.toUpperCase())
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (cached?.length) {
      return NextResponse.json({
        success: true,
        analysis: (cached[0] as any).analysis,
        cached: true,
        remaining: 5 - (count ?? 0),
        created_at: (cached[0] as any).created_at,
      });
    }

    // 종목 데이터 조회
    const { data: stock } = await (supabase as any).from('stock_quotes')
      .select('symbol, name, price, change_pct, change_amt, volume, market_cap, sector, market, high_52w, low_52w, per, pbr, dividend_yield, description')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (!stock) return NextResponse.json({ error: '종목을 찾을 수 없습니다' }, { status: 404 });

    // 최근 가격 히스토리
    const { data: priceHistory } = await (supabase as any).from('stock_price_history')
      .select('date, close, volume')
      .eq('symbol', symbol.toUpperCase())
      .order('date', { ascending: false })
      .limit(30);

    // 최근 뉴스
    const { data: news } = await (supabase as any).from('stock_news')
      .select('title, ai_summary, sentiment')
      .eq('symbol', symbol.toUpperCase())
      .order('published_at', { ascending: false })
      .limit(5);

    // AI 분석 호출
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI 서비스 준비 중입니다' }, { status: 503 });
    }

    const priceData = priceHistory?.slice(0, 20).map((p: any) =>
      `${p.date}: ${Number(p.close).toLocaleString()}원`
    ).join(', ') || '없음';

    const newsData = news?.map((n: any) =>
      `[${n.sentiment}] ${n.title}`
    ).join('\n') || '없음';

    const prompt = `한국 주식 종목 심층 분석을 해주세요.

종목: ${stock.name} (${stock.symbol})
시장: ${stock.market} | 섹터: ${stock.sector || '미분류'}
현재가: ${Number(stock.price).toLocaleString()}원 (${Number(stock.change_pct) > 0 ? '+' : ''}${Number(stock.change_pct).toFixed(2)}%)
시가총액: ${stock.market_cap ? (Number(stock.market_cap) / 1e8).toFixed(0) + '억원' : '미제공'}
52주 최고/최저: ${stock.high_52w ? Number(stock.high_52w).toLocaleString() : '-'} / ${stock.low_52w ? Number(stock.low_52w).toLocaleString() : '-'}
PER: ${stock.per || '-'} | PBR: ${stock.pbr || '-'} | 배당수익률: ${stock.dividend_yield || '-'}%
기업소개: ${stock.description || '없음'}

최근 주가 추이 (최신→과거):
${priceData}

최근 뉴스:
${newsData}

다음 4개 섹션으로 분석하세요:
1. 기업개요: 핵심 사업과 경쟁력 2~3줄
2. 기술적분석: 최근 주가 흐름, 지지/저항 수준, 추세 방향
3. 펀더멘탈: PER/PBR 기반 밸류에이션, 섹터 내 위치
4. 종합의견: 투자 매력도와 리스크 요인

JSON만 응답: {"overview":"...","technical":"...","fundamental":"...","opinion":"...","score":7,"risk":"medium"}
score: 1~10 투자매력도, risk: low/medium/high`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: AI_MODEL_HAIKU,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      if (res.status === 402 || res.status === 529) {
        return NextResponse.json({ error: 'AI 서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'AI 분석에 실패했습니다' }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
    }

    const analysis = JSON.parse(match[0]);

    // DB 저장 (사용량 추적 + 캐싱)
    await (supabase as any).from('stock_ai_analysis').insert({
      user_id: user.id,
      symbol: stock.symbol,
      stock_name: stock.name,
      analysis,
    });

    return NextResponse.json({
      success: true,
      analysis,
      cached: false,
      remaining: 5 - (count ?? 0) - 1,
    });

  } catch (err) {
    console.error('[stock/ai-analysis]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류' },
      { status: 500 }
    );
  }
}

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMon = new Date(now);
  nextMon.setDate(now.getDate() + daysUntilMonday);
  nextMon.setHours(0, 0, 0, 0);
  return nextMon.toISOString();
}
