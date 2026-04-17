export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { sanitizeAiContent } from '@/lib/ai/sanitize-investment-content';

/**
 * 수급 시그널 탐지 크론
 * 
 * flow_snapshots_krx 테이블에서 조합 신호를 추출해서
 * flow_signals 테이블에 저장.
 * 매일 16:00~16:30 (장 마감 후) 실행 권장.
 * 
 * 10개 시그널 레시피:
 * 1. foreign_buying_breakout — 외국인 5일 누적 순매수 이상치
 * 2. institution_buying_streak — 기관 3일 연속 순매수
 * 3. flow_reversal — 외인+기관 동시 방향 전환
 * 4. short_cover_candidate — 대차잔고↓ + 주가↑
 * 5. overheat_reversal — 공매도 과열 + 외인 매수
 * 6. individual_capitulation — 개인 투매 + 외인 매수
 * 7. volume_spike_flat — 거래대금↑↑ + 주가 소폭
 * 8. program_buy_dominant — 프로그램 매수 우위
 * 9. sector_rotation — 대형 vs 중소형 자금이동
 * 10. pre_dividend_accumulation — 배당락 전 매수 집중
 */

const sb = () => getSupabaseAdmin();

interface SignalResult {
  signal_type: string;
  symbol: string;
  strength: number;
  metadata: Record<string, any>;
}

// ─── 시그널 1: 외국인 5일 누적 순매수 이상치 ───
async function detectForeignBuyingBreakout(): Promise<SignalResult[]> {
  const supabase = sb();
  const signals: SignalResult[] = [];

  // stock_investor_flow 테이블에서 최근 5일 데이터
  const { data } = await supabase.from('stock_investor_flow')
    .select('symbol, foreign_buy, foreign_sell, date')
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order('date', { ascending: false });

  if (!data?.length) return signals;

  const symbolMap: Record<string, { total: number; days: number }> = {};
  for (const row of data as any[]) {
    if (!symbolMap[row.symbol]) symbolMap[row.symbol] = { total: 0, days: 0 };
    const foreignNet = Number(row.foreign_buy || 0) - Number(row.foreign_sell || 0);
    symbolMap[row.symbol].total += foreignNet;
    symbolMap[row.symbol].days++;
  }

  const totals = Object.values(symbolMap).map(v => v.total);
  if (totals.length < 3) return signals;
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const std = Math.sqrt(totals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / totals.length) || 1;

  for (const [symbol, v] of Object.entries(symbolMap)) {
    if (v.total > mean + 2 * std && v.days >= 3) {
      signals.push({
        signal_type: 'foreign_buying_breakout',
        symbol,
        strength: Math.min(10, Math.round(((v.total - mean) / std) * 2)),
        metadata: { five_day_net: v.total, mean, std, days: v.days },
      });
    }
  }

  return signals.slice(0, 20);
}

// ─── 시그널 2: 기관 3일 연속 순매수 ───
async function detectInstitutionStreak(): Promise<SignalResult[]> {
  const supabase = sb();
  const signals: SignalResult[] = [];

  const { data } = await supabase.from('stock_investor_flow')
    .select('symbol, inst_buy, inst_sell, date')
    .gte('date', new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10))
    .order('date', { ascending: false });

  if (!data?.length) return signals;

  const symbolDays: Record<string, number[]> = {};
  for (const row of data as any[]) {
    if (!symbolDays[row.symbol]) symbolDays[row.symbol] = [];
    const instNet = Number(row.inst_buy || 0) - Number(row.inst_sell || 0);
    symbolDays[row.symbol].push(instNet);
  }

  for (const [symbol, nets] of Object.entries(symbolDays)) {
    const recent3 = nets.slice(0, 3);
    if (recent3.length >= 3 && recent3.every(n => n > 0)) {
      const total = recent3.reduce((a, b) => a + b, 0);
      signals.push({
        signal_type: 'institution_buying_streak',
        symbol,
        strength: Math.min(10, Math.round(total / 1e8)),
        metadata: { streak_days: 3, total_net: total, daily: recent3 },
      });
    }
  }

  return signals.slice(0, 20);
}

// ─── 시그널 6: 개인 투매 + 외인 매수 ───
async function detectIndividualCapitulation(): Promise<SignalResult[]> {
  const supabase = sb();
  const signals: SignalResult[] = [];

  const { data } = await supabase.from('stock_investor_flow')
    .select('symbol, foreign_buy, foreign_sell, retail_buy, retail_sell, date')
    .gte('date', new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
    .order('date', { ascending: false });

  if (!data?.length) return signals;

  const symbolMap: Record<string, { foreign: number; individual: number }> = {};
  for (const row of data as any[]) {
    if (!symbolMap[row.symbol]) symbolMap[row.symbol] = { foreign: 0, individual: 0 };
    symbolMap[row.symbol].foreign += Number(row.foreign_buy || 0) - Number(row.foreign_sell || 0);
    symbolMap[row.symbol].individual += Number(row.retail_buy || 0) - Number(row.retail_sell || 0);
  }

  for (const [symbol, v] of Object.entries(symbolMap)) {
    if (v.individual < -1e8 && v.foreign > 1e8) {
      signals.push({
        signal_type: 'individual_capitulation',
        symbol,
        strength: Math.min(10, Math.round(Math.abs(v.individual) / 1e9)),
        metadata: { foreign_3d: v.foreign, individual_3d: v.individual },
      });
    }
  }

  return signals.slice(0, 20);
}

// ─── AI 해석 생성 ───
async function generateInterpretation(signal: SignalResult): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  const typeLabels: Record<string, string> = {
    foreign_buying_breakout: '외국인 대량 순매수',
    institution_buying_streak: '기관 연속 순매수',
    individual_capitulation: '개인 투매 후 외인 유입',
  };

  const prompt = `다음 수급 시그널에 대해 한국어 2~3문장으로 해석하세요. 투자 권유 없이 팩트만.
시그널: ${typeLabels[signal.signal_type] || signal.signal_type}
종목: ${signal.symbol}
강도: ${signal.strength}/10
데이터: ${JSON.stringify(signal.metadata)}

해석만 출력하세요.`;

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text?.trim() || '';
    return sanitizeAiContent(raw).text;
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-flow-signals', async () => {
    const supabase = sb();
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

    // 시그널 탐지 (병렬)
    const [foreignBuying, institutionStreak, capitulation] = await Promise.all([
      detectForeignBuyingBreakout(),
      detectInstitutionStreak(),
      detectIndividualCapitulation(),
    ]);

    const allSignals = [...foreignBuying, ...institutionStreak, ...capitulation];
    let created = 0;
    let apiCalls = 0;

    // 상위 시그널에만 AI 해석 생성 (비용 절감)
    const topSignals = allSignals
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 15);

    for (const signal of topSignals) {
      const interpretation = await generateInterpretation(signal);
      if (interpretation) apiCalls++;

      const { error } = await (supabase as any).from('flow_signals').insert({
        signal_type: signal.signal_type,
        symbol: signal.symbol,
        signal_date: today,
        strength: signal.strength,
        interpretation_ko: interpretation || null,
        metadata: signal.metadata,
      });

      if (!error) created++;
    }

    return {
      processed: allSignals.length,
      created,
      failed: topSignals.length - created,
      metadata: {
        api_name: 'anthropic',
        api_calls: apiCalls,
        by_type: {
          foreign_buying: foreignBuying.length,
          institution_streak: institutionStreak.length,
          individual_capitulation: capitulation.length,
        },
      },
    };
  });

  return NextResponse.json(result);
}
