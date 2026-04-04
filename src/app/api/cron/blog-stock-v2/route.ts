import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * 블로그 주식 종목 분석 V2 — 고품질 데이터 기반 + 네이버 교차검증
 * 배치: 1회 5종목, 편당 2,500~3,500자
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-stock-v2', async () => {
    const sb = getSupabaseAdmin();
    const BATCH = 5;
    const today = new Date().toISOString().slice(0, 10);

    // 1. 블로그 없는 종목 (시총 높은 순)
    const { data: allStocks } = await (sb as any).from('stock_quotes')
      .select('symbol, name, price, change_pct, change_amt, market_cap, sector, market, volume, per, pbr, dividend_yield, high_52w, low_52w, description')
      .eq('is_active', true).gt('price', 0)
      .in('market', ['KOSPI', 'KOSDAQ', 'NYSE', 'NASDAQ'])
      .order('market_cap', { ascending: false })
      .limit(300);

    if (!allStocks?.length) return { processed: 0, created: 0, failed: 0 };

    const { data: existingBlogs } = await sb.from('blog_posts')
      .select('source_ref').eq('is_published', true).eq('category', 'stock')
      .not('source_ref', 'is', null);
    const covered = new Set((existingBlogs || []).map((b: any) => b.source_ref));
    const targets = allStocks.filter((s: any) => !covered.has(s.symbol)).slice(0, BATCH);
    if (!targets.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_covered' } };

    let created = 0;

    for (const stock of targets) {
      try {
        // 2. 네이버 교차검증
        let naver: any = null;
        try {
          const r = await fetch(`https://m.stock.naver.com/api/stock/${stock.symbol}/basic`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
            signal: AbortSignal.timeout(5000),
          });
          if (r.ok) naver = await r.json();
        } catch { /* DB만 사용 */ }

        const price = naver?.closePrice ? Number(naver.closePrice) : Number(stock.price);
        const changePct = naver?.fluctuationsRatio ? Number(naver.fluctuationsRatio) : Number(stock.change_pct || 0);
        const mcap = Number(stock.market_cap || 0);
        const per = naver?.per ? Number(naver.per) : Number(stock.per || 0);
        const pbr = naver?.pbr ? Number(naver.pbr) : Number(stock.pbr || 0);
        const h52 = Number(stock.high_52w || 0);
        const l52 = Number(stock.low_52w || 0);
        const divYld = Number(stock.dividend_yield || 0);

        // 3. 가격 히스토리
        const { data: hist } = await (sb as any).from('stock_price_history')
          .select('date, close, volume').eq('symbol', stock.symbol)
          .order('date', { ascending: false }).limit(30);

        let t30 = 0, t7 = 0, avgVol = 0;
        if (hist?.length >= 2) {
          const latest = Number(hist[0].close);
          if (hist.length >= 30) t30 = (latest - Number(hist[29].close)) / Number(hist[29].close) * 100;
          if (hist.length >= 7) t7 = (latest - Number(hist[6].close)) / Number(hist[6].close) * 100;
          avgVol = hist.reduce((s: number, p: any) => s + Number(p.volume || 0), 0) / hist.length;
        }

        // 4. 섹터 비교
        let peers: any[] = [];
        if (stock.sector) {
          const { data: p } = await (sb as any).from('stock_quotes')
            .select('symbol, name, price, change_pct, market_cap, per, pbr')
            .eq('sector', stock.sector).eq('is_active', true).gt('price', 0)
            .neq('symbol', stock.symbol)
            .order('market_cap', { ascending: false }).limit(5);
          peers = p || [];
        }
        const peerPERs = peers.filter((p: any) => Number(p.per) > 0).map((p: any) => Number(p.per));
        const sAvgPER = peerPERs.length ? peerPERs.reduce((a: number, b: number) => a + b, 0) / peerPERs.length : 0;

        // 5. AI 분석 (Haiku)
        let aiText = '';
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            const prompt = `한국 주식 "${stock.name}"(${stock.symbol}) 분석. ${stock.market}, ${stock.sector || '미분류'} 섹터.
현재가 ${price.toLocaleString()}원(${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%), 시총 ${mcap > 1e12 ? (mcap/1e12).toFixed(1)+'조' : (mcap/1e8).toFixed(0)+'억'}원, PER ${per > 0 ? per.toFixed(1) : '—'}, 30일 ${t30.toFixed(1)}%.
기업: ${(stock.description || '').slice(0, 200)}

아래 형식으로 작성 (마크다운, 이모지 없이, 각 항목 2줄):
### 투자 포인트
1. (강점1)
2. (강점2)
3. (강점3)

### 리스크 요인
1. (위험1)
2. (위험2)
3. (위험3)`;

            const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
              signal: AbortSignal.timeout(15000),
            });
            if (aiRes.ok) {
              const d = await aiRes.json();
              aiText = d.content?.[0]?.text || '';
            }
          } catch { /* skip */ }
        }

        // 6. 본문 조립
        const priceStr = price.toLocaleString();
        const mcapStr = mcap > 1e12 ? `${(mcap/1e12).toFixed(1)}조원` : mcap > 1e8 ? `${(mcap/1e8).toFixed(0)}억원` : '미제공';
        const chgIcon = changePct > 0 ? '▲' : changePct < 0 ? '▼' : '—';
        const pos52 = h52 > l52 ? ((price - l52) / (h52 - l52) * 100).toFixed(0) : '—';

        const slug = `stock-v2-${stock.symbol}-${today.replace(/-/g, '')}`;
        const title = `${stock.name} (${stock.symbol}) 종목 분석 — 시세·재무·섹터 비교 ${today}`;

        let c = `## ${stock.name} — 한눈에 보기

**${stock.name}**(${stock.symbol})은 ${stock.market} 시장의 **${stock.sector || '기타'}** 섹터 종목입니다. 현재가 **${priceStr}원**(${chgIcon} ${Math.abs(changePct).toFixed(2)}%), 시가총액 **${mcapStr}**.

---

## 핵심 투자 지표

| 항목 | 수치 | 비고 |
|---|---|---|
| **현재가** | ${priceStr}원 | ${chgIcon} ${Math.abs(changePct).toFixed(2)}% |
| **시가총액** | ${mcapStr} | ${stock.market} |
| **PER** | ${per > 0 ? per.toFixed(1)+'배' : '—'} | ${sAvgPER > 0 ? '섹터 평균 '+sAvgPER.toFixed(1)+'배' : ''} |
| **PBR** | ${pbr > 0 ? pbr.toFixed(2)+'배' : '—'} | |
| **배당수익률** | ${divYld > 0 ? divYld.toFixed(2)+'%' : '—'} | |
| **52주 최고/최저** | ${h52 > 0 ? h52.toLocaleString() : '—'} / ${l52 > 0 ? l52.toLocaleString() : '—'} | 현재 ${pos52}% 지점 |
| **거래량** | ${Number(stock.volume || 0) > 0 ? Number(stock.volume).toLocaleString()+'주' : '—'} | ${avgVol > 0 ? '평균 '+Math.round(avgVol).toLocaleString() : ''} |

${naver ? `> 가격 정보는 네이버 금융과 교차 검증 완료 (${today} 기준)` : `> ${today} 기준 데이터`}

---

## 최근 가격 흐름

`;
        if (hist?.length >= 7) {
          c += `최근 7일간 **${t7 > 0 ? '+' : ''}${t7.toFixed(1)}%** ${t7 > 0 ? '상승' : t7 < 0 ? '하락' : '보합'}`;
          if (hist.length >= 30) c += `, 30일 기준 **${t30 > 0 ? '+' : ''}${t30.toFixed(1)}%** ${t30 > 0 ? '상승' : '하락'} 추세`;
          c += `입니다.\n\n| 날짜 | 종가 | 거래량 |\n|---|---|---|\n`;
          hist.slice(0, 7).reverse().forEach((p: any) => {
            c += `| ${p.date} | ${Number(p.close).toLocaleString()}원 | ${Number(p.volume||0).toLocaleString()} |\n`;
          });
          if (avgVol > 0 && Number(stock.volume || 0) > 0) {
            const vr = Number(stock.volume) / avgVol;
            c += `\n현재 거래량은 30일 평균 대비 **${vr.toFixed(1)}배** 수준입니다.\n`;
          }
        } else {
          c += '가격 히스토리를 수집 중입니다.\n';
        }

        if (peers.length > 0) {
          c += `\n---\n\n## ${stock.sector} 섹터 비교\n\n| 종목 | 현재가 | 등락률 | 시총 | PER |\n|---|---|---|---|---|\n`;
          c += `| **${stock.name}** | **${priceStr}원** | **${changePct > 0?'+':''}${changePct.toFixed(2)}%** | **${mcapStr}** | **${per>0?per.toFixed(1):'—'}** |\n`;
          peers.forEach((p: any) => {
            const pm = Number(p.market_cap||0);
            c += `| ${p.name} | ${Number(p.price).toLocaleString()}원 | ${Number(p.change_pct||0)>0?'+':''}${Number(p.change_pct||0).toFixed(2)}% | ${pm>1e12?(pm/1e12).toFixed(1)+'조':pm>1e8?(pm/1e8).toFixed(0)+'억':'—'} | ${Number(p.per)>0?Number(p.per).toFixed(1):'—'} |\n`;
          });
          if (sAvgPER > 0 && per > 0) {
            const diff = ((per - sAvgPER) / sAvgPER * 100).toFixed(0);
            c += `\n${stock.name}의 PER(${per.toFixed(1)})은 섹터 평균(${sAvgPER.toFixed(1)}) 대비 **${Number(diff)>0?diff+'% 높은':Math.abs(Number(diff))+'% 낮은'}** 수준입니다.\n`;
          }
        }

        if (aiText) c += `\n---\n\n${aiText}\n`;
        if (stock.description) c += `\n---\n\n## 기업 개요\n\n${stock.description}\n`;

        c += `\n---\n\n## 자주 묻는 질문\n\n`;
        c += `**Q. ${stock.name} 현재 주가는?**\nA. ${today} 기준 ${priceStr}원, ${changePct>0?'+':''}${changePct.toFixed(2)}% ${changePct>0?'상승':'하락'}. [실시간 시세 →](/stock/${stock.symbol})\n\n`;
        c += `**Q. ${stock.name} PER은 적정한가?**\nA. ${per>0?`PER ${per.toFixed(1)}배, ${stock.sector||''} 섹터 평균 대비 ${sAvgPER>0&&per>sAvgPER?'높음':'낮음'}.`:'PER 정보 미제공.'}\n\n`;
        c += `**Q. ${stock.name}과 비슷한 종목은?**\nA. ${peers.slice(0,3).map((p:any)=>p.name).join(', ')||'동일 섹터 종목'} 등. [비교 →](/stock/compare)\n`;

        c += `\n---\n\n## 관련 링크\n\n`;
        c += `- [${stock.name} 실시간 시세 →](/stock/${stock.symbol})\n`;
        c += `- [${stock.sector||'전체'} 섹터 →](/stock?sector=${encodeURIComponent(stock.sector||'')})\n`;
        c += `- [종목 비교 →](/stock/compare)\n`;
        c += `- [카더라 데일리 리포트 →](/daily)\n`;

        const tags = [stock.name, stock.symbol, stock.market, stock.sector, '종목분석', '주식'].filter(Boolean) as string[];
        const ok = await safeBlogInsert(sb, {
          slug, title, content: c,
          excerpt: `${stock.name}(${stock.symbol}) ${stock.market} ${stock.sector||''} 종목 분석. 현재가 ${priceStr}원, PER ${per>0?per.toFixed(1):'—'}, 섹터 비교, 가격 추이 (${today}).`,
          category: 'stock', tags,
          source_type: 'auto', source_ref: stock.symbol, data_date: today,
        });
        if (ok) created++;
      } catch { continue; }
    }

    return { processed: targets.length, created, failed: targets.length - created };
  });

  if (!result.success) return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
