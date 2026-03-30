import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

/**
 * 종목 description AI 자동생성 크론
 * 
 * description이 없는 종목에 대해 AI가 2~3문장 한국어 설명 생성
 * - KOSPI/KOSDAQ: 한국어 종목명+섹터 기반
 * - NYSE/NASDAQ: 영문 종목명+섹터 기반, 한국어 설명
 * 
 * 배치: 20건/실행 (Haiku, 저비용)
 * 스케줄: 매 6시간
 * 예상: 578건 / 20건 = 29회, ~7일이면 완료
 */

const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY || '';

// 템플릿 기반 description 생성 (크레딧 불필요)
function generateTemplateDesc(s: { symbol: string; name: string; market: string; sector: string | null; price: number; market_cap: number }): string {
  const fmtCap = (n: number) => {
    if (n >= 1000000000000) return `${(n / 1000000000000).toFixed(1)}조원`;
    if (n >= 100000000) return `${Math.round(n / 100000000).toLocaleString()}억원`;
    return `${n.toLocaleString()}원`;
  };
  const fmtPrice = (p: number) => p >= 10000 ? `${(p).toLocaleString()}원` : `${p}원`;
  const marketLabel = s.market === 'KOSPI' || s.market === 'KOSDAQ' ? `${s.market} 상장` : `${s.market} 상장`;
  const sectorLabel = s.sector ? `${s.sector} 섹터` : '';
  const capLabel = s.market_cap > 0 ? `시가총액 ${fmtCap(s.market_cap)}` : '';

  if (s.market === 'NYSE' || s.market === 'NASDAQ') {
    return `${s.name}(${s.symbol})은(는) ${marketLabel}된 ${sectorLabel ? sectorLabel + ' ' : ''}글로벌 기업입니다.${capLabel ? ` ${capLabel}.` : ''} 현재가 $${Number(s.price).toFixed(2)}.`;
  }
  return `${s.name}(${s.symbol})은(는) ${marketLabel}된 ${sectorLabel ? sectorLabel + ' ' : ''}기업입니다.${capLabel ? ` ${capLabel}.` : ''} 현재가 ${fmtPrice(Number(s.price))}.`;
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('stock-desc-gen', async () => {
    const sb = getSupabaseAdmin();
    const BATCH = 50;

    const { data: targets } = await sb.from('stock_quotes')
      .select('symbol, name, market, sector, price, market_cap')
      .or('description.is.null,description.eq.')
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(BATCH);

    if (!targets?.length) {
      return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { message: 'description 누락 없음' } };
    }

    let updated = 0;
    let failed = 0;
    let mode = 'template';

    // AI 시도 (키 있을 때만, 최대 20건)
    if (ANTHROPIC_KEY()) {
      try {
        const aiBatch = targets.slice(0, 20);
        const stockList = aiBatch.map((s: any, i: number) =>
          `${i + 1}. ${s.symbol} | ${s.name} | ${s.market} | ${s.sector || '미분류'} | 시총 ${s.market_cap ? Math.round(s.market_cap / 100000000) + '억' : '미정'}`
        ).join('\n');
        const prompt = `다음 주식 종목들의 한국어 설명을 각각 2~3문장으로. 핵심 사업 위주. JSON만: [{"n":1,"desc":"..."}]\n${stockList}`;
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY(), 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const text = ((await res.json())?.content?.[0]?.text || '').replace(/```json\s*|```/g, '').trim();
          const match = text.match(/\[[\s\S]*\]/);
          if (match) {
            const descs: { n: number; desc: string }[] = JSON.parse(match[0]);
            for (const item of descs) {
              const idx = item.n - 1;
              if (idx >= 0 && idx < aiBatch.length && item.desc) {
                const { error } = await sb.from('stock_quotes').update({ description: item.desc }).eq('symbol', aiBatch[idx].symbol);
                if (!error) { updated++; mode = 'ai+template'; }
              }
            }
          }
        }
      } catch { /* AI 실패 → 템플릿 폴백 */ }
    }

    // 템플릿으로 나머지 채우기 (AI 처리 안 된 것 + AI 없을 때 전체)
    const { data: remaining } = await sb.from('stock_quotes')
      .select('symbol, name, market, sector, price, market_cap')
      .or('description.is.null,description.eq.')
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(BATCH);

    for (const stock of (remaining || [])) {
      const desc = generateTemplateDesc(stock as any);
      const { error } = await sb.from('stock_quotes').update({ description: desc }).eq('symbol', stock.symbol);
      if (error) { failed++; } else { updated++; }
    }

    return { processed: targets.length, created: updated, updated, failed, metadata: { mode, batch: targets.length } };
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
