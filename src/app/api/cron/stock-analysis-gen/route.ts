import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function handler(_req: NextRequest) {
  const admin = getSupabaseAdmin();

  const { data: stocks } = await (admin as any).from('stock_quotes')
    .select('symbol, name, market, price, change_amt, change_pct, volume, market_cap, sector, currency, description, per, pbr, dividend_yield, high_52w, low_52w, eps, roe')
    .is('analysis_text', null)
    .eq('is_active', true)
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(5);

  if (!stocks || stocks.length === 0) {
    return { processed: 0, metadata: { reason: 'all_done' } };
  }

  let processed = 0;
  const errors: string[] = [];

  for (const s of stocks) {
    try {
      // 최근 뉴스
      const { data: news } = await admin.from('stock_news')
        .select('title, source, sentiment_label')
        .eq('symbol', s.symbol)
        .order('published_at', { ascending: false })
        .limit(3);

      // 최근 공시
      const { data: disc } = await admin.from('stock_disclosures')
        .select('title, disclosure_type')
        .eq('symbol', s.symbol)
        .order('published_at', { ascending: false })
        .limit(3);

      const prompt = buildPrompt(s, news, disc);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) { errors.push(`${s.symbol}: API ${res.status}`); continue; }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text || text.length < 400) { errors.push(`${s.symbol}: too_short`); continue; }

      await (admin as any).from('stock_quotes')
        .update({ analysis_text: text, analysis_generated_at: new Date().toISOString() })
        .eq('symbol', s.symbol);

      processed++;
    } catch (e: any) {
      errors.push(`${s.symbol}: ${e.message?.slice(0, 60)}`);
    }
  }

  return { processed, total: stocks.length, errors: errors.length > 0 ? errors : undefined };
}

function buildPrompt(s: any, news: any[], disc: any[]): string {
  const isUS = s.currency === 'USD';
  const fmtP = (v: number) => isUS ? `$${v.toFixed(2)}` : `${v.toLocaleString()}원`;
  const newsStr = news?.length ? news.map((n: any) => `- ${n.title} (${n.sentiment_label || '중립'})`).join('\n') : '최근 뉴스 없음';
  const discStr = disc?.length ? disc.map((d: any) => `- ${d.title}`).join('\n') : '';

  return `한국 주식 전문 분석가로서 "${s.name} (${s.symbol})" 종목의 종합 분석 글을 작성하세요.

## 종목 데이터 (실제 DB 기반)
- 종목명: ${s.name} (${s.symbol})
- 시장: ${s.market}
- 현재가: ${fmtP(Number(s.price))} (${Number(s.change_pct) >= 0 ? '+' : ''}${Number(s.change_pct).toFixed(2)}%)
- 거래량: ${Number(s.volume).toLocaleString()}
- 시가총액: ${s.market_cap ? `${(Number(s.market_cap) / 100000000).toFixed(0)}억원` : '미공개'}
- 섹터: ${s.sector || '미분류'}
- PER: ${s.per || '-'} / PBR: ${s.pbr || '-'}
- 배당수익률: ${s.dividend_yield ? `${Number(s.dividend_yield).toFixed(2)}%` : '-'}
- 52주 최고/최저: ${s.high_52w ? fmtP(Number(s.high_52w)) : '-'} / ${s.low_52w ? fmtP(Number(s.low_52w)) : '-'}
- EPS: ${s.eps || '-'} / ROE: ${s.roe ? `${Number(s.roe).toFixed(1)}%` : '-'}
- 기업설명: ${s.description || '없음'}

## 최근 뉴스
${newsStr}
${discStr ? `\n## 최근 공시\n${discStr}` : ''}

## 작성 규칙
1. 1,500자 이상 작성
2. 아래 4개 섹션 필수 (## 소제목)
3. 수치 데이터 정확히 인용
4. 투자 의견/분석 포함 (D.I.A 적합)
5. 마크다운, "## 목차" 금지, ## 안에 **볼드** 금지
6. FAQ는 ### Q. 형식

## ${s.name} 기업 개요
(사업 구조, 핵심 경쟁력, 업종 내 위치)

## 투자 포인트 분석
(최근 뉴스/실적 기반 전망, 52주 고저 대비 현재 위치)

## 밸류에이션 분석
(PER/PBR 해석 + 동종업계 대비, 배당 분석)
→ 내부 링크: [실시간 시세 →](/stock) [종목 비교 →](/stock/compare)

## 자주 묻는 질문
(### Q. 형식 5개, 배당금/PER/전망 등)

면책: "※ 본 분석은 데이터 기반 참고 자료이며, 투자 판단은 본인 책임입니다."`;
}

export async function GET(req: NextRequest) {
  const result = await withCronLogging('stock-analysis-gen', req, handler);
  return NextResponse.json(result);
}
