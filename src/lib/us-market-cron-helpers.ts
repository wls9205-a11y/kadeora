/**
 * 미국 시장 크론 공통 유틸리티
 * 
 * 야간 크론 5~10종이 공유하는 데이터 조회 + AI 생성 로직
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AI_MODEL_HAIKU, AI_MODEL_SONNET, ANTHROPIC_VERSION } from '@/lib/constants';
import { sanitizeAiContent, ensureDisclaimer } from '@/lib/ai/sanitize-investment-content';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

const supabase = getSupabaseAdmin();

/** 미국 주식 시세 조회 (등락률 상위/하위) */
export async function getUSMarketSnapshot() {
  const { data: stocks } = await supabase
    .from('stock_quotes')
    .select('symbol, name, price, change_amt, change_pct, volume, market_cap, currency, sector, updated_at')
    .in('market', ['NYSE', 'NASDAQ'])
    .eq('is_active', true)
    .order('market_cap', { ascending: false })
    .limit(500);

  const allStocks = (stocks || []).filter(s => {
    const pct = Number(s.change_pct ?? 0);
    return pct >= -50 && pct <= 50; // 극단값 필터
  });

  const sorted = [...allStocks].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
  const topGainers = sorted.filter(s => Number(s.change_pct ?? 0) > 0).slice(0, 10);
  const topLosers = [...sorted].reverse().filter(s => Number(s.change_pct ?? 0) < 0).slice(0, 10);

  // 섹터별 평균
  const sectorMap: Record<string, { total: number; count: number }> = {};
  for (const s of allStocks) {
    const sec = s.sector || 'Other';
    if (!sectorMap[sec]) sectorMap[sec] = { total: 0, count: 0 };
    sectorMap[sec].total += Number(s.change_pct ?? 0);
    sectorMap[sec].count++;
  }
  const sectorPerf = Object.entries(sectorMap)
    .map(([name, v]) => ({ name, avg_pct: +(v.total / v.count).toFixed(2) }))
    .sort((a, b) => b.avg_pct - a.avg_pct);

  return { allStocks, topGainers, topLosers, sectorPerf };
}

/** AI 시황 생성 (Haiku or Sonnet) */
export async function generateUSBriefing(opts: {
  type: 'premarket' | 'opening' | 'midday' | 'closing' | 'aftermarket' | 'daily_recap';
  topGainers: any[];
  topLosers: any[];
  sectorPerf: any[];
  useSonnet?: boolean;
}): Promise<{ title: string; content: string; apiCalls: number } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const typeLabels: Record<string, string> = {
    premarket: '프리마켓 워치리스트',
    opening: '개장 15분 후 속보',
    midday: '정오 업데이트',
    closing: '마감 요약',
    aftermarket: '시간외 실적 발표',
    daily_recap: '전일 미국장 종합 브리핑',
  };

  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const label = typeLabels[opts.type] || opts.type;

  const gainersText = opts.topGainers.slice(0, 5)
    .map(s => `${s.name}(${s.symbol}, ${Number(s.change_pct) > 0 ? '+' : ''}${Number(s.change_pct).toFixed(1)}%)`)
    .join(', ');
  const losersText = opts.topLosers.slice(0, 5)
    .map(s => `${s.name}(${s.symbol}, ${Number(s.change_pct).toFixed(1)}%)`)
    .join(', ');
  const sectorText = opts.sectorPerf.slice(0, 5)
    .map(s => `${s.name}(${s.avg_pct > 0 ? '+' : ''}${s.avg_pct}%)`)
    .join(', ');

  const prompt = `당신은 카더라 증시팀 기자입니다. 오늘 ${kstDate} 미국 증시 "${label}" 브리핑을 작성하세요.

데이터:
상승 TOP5: ${gainersText || '정보 없음'}
하락 TOP5: ${losersText || '정보 없음'}
섹터별: ${sectorText || '정보 없음'}

작성 규칙:
1. 제목(## 없이 한 줄)과 본문(markdown)을 작성
2. 첫 줄이 제목, 빈 줄 이후 본문
3. 팩트 기반, 투자 권유 표현 절대 금지
4. "~할 수 있다", "~가능성" 같은 불확실성 표현 사용
5. h2 소제목 3~5개, 총 800~1500자
6. 마지막 소제목: "내일(오늘) 관전 포인트"`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.useSonnet ? AI_MODEL_SONNET : AI_MODEL_HAIKU,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text?.trim() || '';
    if (!raw) return null;

    // 첫 줄 = 제목, 나머지 = 본문
    const lines = raw.split('\n');
    const title = lines[0].replace(/^#+\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();

    // 투자자문 표현 필터
    const { text: sanitizedBody } = sanitizeAiContent(body);
    const content = ensureDisclaimer(sanitizedBody);

    return { title, content, apiCalls: 1 };
  } catch (e: any) {
    console.error(`[us-briefing] AI error:`, e.message);
    return null;
  }
}

/** 브리핑을 stock_daily_briefing 테이블에 저장 */
export async function saveBriefing(opts: {
  market: string;
  title: string;
  summary: string;
  topGainers: any[];
  topLosers: any[];
  briefingType?: string;
}) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  
  // 같은 날 같은 타입이 있으면 스킵
  const { data: existing } = await supabase
    .from('stock_daily_briefing')
    .select('id')
    .eq('briefing_date', today)
    .eq('market', opts.market)
    .limit(1);

  // US는 일일 여러 번 저장 가능하므로 market을 세분화
  const market = opts.briefingType ? `${opts.market}_${opts.briefingType}` : opts.market;

  const { error } = await supabase.from('stock_daily_briefing').upsert({
    market,
    briefing_date: today,
    title: opts.title,
    summary: opts.summary,
    sentiment: 'neutral',
    top_gainers: opts.topGainers.slice(0, 5).map(s => ({
      symbol: s.symbol,
      name: s.name,
      change_pct: Number(s.change_pct),
    })),
    top_losers: opts.topLosers.slice(0, 5).map(s => ({
      symbol: s.symbol,
      name: s.name,
      change_pct: Number(s.change_pct),
    })),
  }, { onConflict: 'market,briefing_date' });

  if (error) console.error('[saveBriefing]', error.message);
}

/** 브리핑을 블로그 포스트로 발행 */
export async function publishBriefingAsBlog(opts: {
  title: string;
  content: string;
  category: string;
  subCategory: string;
  tags: string[];
}) {
  const supabase = getSupabaseAdmin();
  await safeBlogInsert(supabase, {
    title: opts.title,
    content: opts.content,
    category: opts.category,
    sub_category: opts.subCategory,
    tags: opts.tags,
    author: '카더라 증시팀',
    cover_image: `/api/og?title=${encodeURIComponent(opts.title)}&category=stock&author=${encodeURIComponent('카더라 증시팀')}&design=2`,
  });
}
