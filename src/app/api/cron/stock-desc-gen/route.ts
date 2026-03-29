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

export const GET = withCronAuth(async (_req: NextRequest) => {
  if (!ANTHROPIC_KEY()) {
    return NextResponse.json({ ok: true, error: 'ANTHROPIC_API_KEY not set', updated: 0 });
  }

  const result = await withCronLogging('stock-desc-gen', async () => {
    const sb = getSupabaseAdmin();
    const BATCH = 20;

    // description이 비어있는 종목 조회
    const { data: targets } = await sb.from('stock_quotes')
      .select('symbol, name, market, sector, price, market_cap')
      .or('description.is.null,description.eq.')
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(BATCH);

    if (!targets?.length) {
      return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { message: '전체 완료 — description 누락 없음' } };
    }

    // 배치 프롬프트: 한 번의 AI 콜로 20개 동시 생성
    const stockList = targets.map((s, i) => 
      `${i + 1}. ${s.symbol} | ${s.name} | ${s.market} | ${s.sector || '미분류'} | 시가총액 ${s.market_cap ? Math.round(s.market_cap / 100000000) + '억원' : '미정'}`
    ).join('\n');

    const prompt = `다음 주식 종목들의 한국어 설명(description)을 각각 2~3문장으로 작성해주세요.

규칙:
- 투자자에게 유용한 핵심 사업 설명 위주
- "~하는 기업입니다" 형태
- 해외 종목도 한국어로 설명
- 각 종목은 반드시 번호를 유지하고 JSON 배열로 응답
- 다른 텍스트 없이 JSON만 응답

종목 목록:
${stockList}

응답 형식 (JSON만):
[{"n":1,"desc":"설명..."},{"n":2,"desc":"설명..."}]`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        if (res.status === 529 || res.status === 402) {
          return { processed: 0, created: 0, updated: 0, failed: targets.length, metadata: { error: 'Anthropic 크레딧 부족' } };
        }
        return { processed: 0, created: 0, updated: 0, failed: targets.length, metadata: { error: `API ${res.status}` } };
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      
      // JSON 파싱 (코드블록 제거)
      const clean = text.replace(/```json\s*|```/g, '').trim();
      let descriptions: { n: number; desc: string }[];
      try {
        descriptions = JSON.parse(clean);
      } catch {
        // 부분 파싱 시도
        const match = clean.match(/\[[\s\S]*\]/);
        if (match) {
          try { descriptions = JSON.parse(match[0]); } catch { 
            return { processed: targets.length, created: 0, updated: 0, failed: targets.length, metadata: { error: 'JSON parse failed' } };
          }
        } else {
          return { processed: targets.length, created: 0, updated: 0, failed: targets.length, metadata: { error: 'No JSON array' } };
        }
      }

      let updated = 0;
      let failed = 0;

      for (const item of descriptions) {
        const idx = item.n - 1;
        if (idx < 0 || idx >= targets.length || !item.desc) { failed++; continue; }
        const stock = targets[idx];

        const { error } = await sb.from('stock_quotes')
          .update({ description: item.desc })
          .eq('symbol', stock.symbol);

        if (error) { failed++; } else { updated++; }
      }

      return { processed: targets.length, created: updated, updated, failed, metadata: { aiModel: 'haiku-4.5' } };
    } catch (e) {
      return { processed: targets.length, created: 0, updated: 0, failed: targets.length, metadata: { error: e instanceof Error ? e.message : 'unknown' } };
    }
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
