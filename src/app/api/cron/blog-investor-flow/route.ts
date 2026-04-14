export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  TYPE 10 — 외국인/기관/개인 수급 흐름 (up to 4 posts, March weeks)   */
/* ------------------------------------------------------------------ */

interface FlowRow {
  id: number;
  symbol: string;
  date: string;
  foreign_buy: number;
  foreign_sell: number;
  inst_buy: number;
  inst_sell: number;
  retail_buy: number;
  retail_sell: number;
}

interface QuoteLookup {
  symbol: string;
  name: string;
}

/** Get ISO week-of-month (1-based) for a date in March 2026 */
function weekOfMonth(dateStr: string): number {
  const d = new Date(dateStr);
  // Week 1: Mar 1-7, Week 2: Mar 8-14, Week 3: Mar 15-21, Week 4: Mar 22-31
  return Math.min(Math.ceil(d.getDate() / 7), 4);
}

function buildContent(
  weekNum: number,
  rows: FlowRow[],
  nameMap: Map<string, string>,
): string {
  /* aggregate by symbol */
  const agg = new Map<
    string,
    { symbol: string; fNet: number; iNet: number; rNet: number }
  >();
  for (const r of rows) {
    const cur = agg.get(r.symbol) || { symbol: r.symbol, fNet: 0, iNet: 0, rNet: 0 };
    cur.fNet += (r.foreign_buy || 0) - (r.foreign_sell || 0);
    cur.iNet += (r.inst_buy || 0) - (r.inst_sell || 0);
    cur.rNet += (r.retail_buy || 0) - (r.retail_sell || 0);
    agg.set(r.symbol, cur);
  }

  const all = [...agg.values()];
  const getName = (sym: string) => nameMap.get(sym) || sym;
  const fmt = (v: number) => {
    if (v >= 0) return `+${v.toLocaleString()}`;
    return v.toLocaleString();
  };

  /* rankings */
  const foreignTop5 = [...all].sort((a, b) => b.fNet - a.fNet).slice(0, 5);
  const foreignBot5 = [...all].sort((a, b) => a.fNet - b.fNet).slice(0, 5);
  const instTop5 = [...all].sort((a, b) => b.iNet - a.iNet).slice(0, 5);
  const instBot5 = [...all].sort((a, b) => a.iNet - b.iNet).slice(0, 5);

  /* totals */
  const totalForeignNet = all.reduce((s, a) => s + a.fNet, 0);
  const totalInstNet = all.reduce((s, a) => s + a.iNet, 0);
  const totalRetailNet = all.reduce((s, a) => s + a.rNet, 0);

  /* 3-color card table */
  const cardRows = all
    .slice(0, 15)
    .map(
      (a) =>
        `| ${getName(a.symbol)} | ${fmt(a.fNet)} | ${fmt(a.iNet)} | ${fmt(a.rNet)} |`,
    )
    .join('\n');

  return `## 2026년 3월 ${weekNum}주차 투자자별 수급 개요

이번 주 국내 증시의 외국인, 기관, 개인 투자자별 순매수/순매도 동향을 분석합니다.

### 3색 수급 카드

| 종목 | 외국인🔵 | 기관🟠 | 개인🟢 |
|------|----------|--------|--------|
${cardRows || '| (데이터 없음) | - | - | - |'}

### 투자자별 합계

| 투자자 | 순매수/순매도 |
|--------|---------------|
| 외국인🔵 | ${fmt(totalForeignNet)} |
| 기관🟠 | ${fmt(totalInstNet)} |
| 개인🟢 | ${fmt(totalRetailNet)} |

${totalForeignNet > 0 ? '외국인이 순매수 기조를 보이고 있어 긍정적 신호입니다.' : '외국인이 순매도 기조로 전환하여 주의가 필요합니다.'}
${totalInstNet > 0 ? '기관 역시 매수세를 유지하고 있습니다.' : '기관은 차익 실현에 나서는 모습입니다.'}

## 외국인 순매수 TOP 5

외국인 투자자가 가장 많이 사들인 종목입니다.

| 순위 | 종목 | 순매수 |
|------|------|--------|
${foreignTop5.map((a, i) => `| ${i + 1} | ${getName(a.symbol)} | ${fmt(a.fNet)} |`).join('\n')}

${foreignTop5.length > 0 ? `1위 **${getName(foreignTop5[0].symbol)}**은 외국인이 ${fmt(foreignTop5[0].fNet)}을 순매수했습니다. 외국인 수급은 중장기 추세를 반영하는 경우가 많아 관심을 가질 필요가 있습니다.` : ''}

### 외국인 순매도 상위

${foreignBot5.filter((a) => a.fNet < 0).length > 0 ? foreignBot5.filter((a) => a.fNet < 0).map((a, i) => `${i + 1}. **${getName(a.symbol)}** ${fmt(a.fNet)}`).join('\n') : '- 이번 주 뚜렷한 외국인 순매도 종목이 없습니다.'}

## 기관 순매수 TOP 5

기관 투자자(연기금, 보험, 자산운용사 등)의 매수 상위 종목입니다.

| 순위 | 종목 | 순매수 |
|------|------|--------|
${instTop5.map((a, i) => `| ${i + 1} | ${getName(a.symbol)} | ${fmt(a.iNet)} |`).join('\n')}

${instTop5.length > 0 ? `기관은 **${getName(instTop5[0].symbol)}**을 가장 많이 순매수했습니다. 기관 수급은 실적 기반의 밸류에이션 분석에 기초하는 경향이 있습니다.` : ''}

### 기관 순매도 상위

${instBot5.filter((a) => a.iNet < 0).length > 0 ? instBot5.filter((a) => a.iNet < 0).map((a, i) => `${i + 1}. **${getName(a.symbol)}** ${fmt(a.iNet)}`).join('\n') : '- 이번 주 뚜렷한 기관 순매도 종목이 없습니다.'}

## 수급 흐름 분석

${totalForeignNet > 0 && totalInstNet > 0 ? '외국인과 기관이 동반 순매수한 주간으로, 시장에 긍정적인 수급 환경이 조성되었습니다. 이 경우 개인은 차익 실현 매물을 소화하는 역할을 하는 경우가 많습니다.' : totalForeignNet > 0 && totalInstNet < 0 ? '외국인은 매수, 기관은 매도로 엇갈린 수급을 보였습니다. 외국인이 선호하는 대형주 위주의 매매와 기관의 리밸런싱이 동시에 진행된 것으로 분석됩니다.' : totalForeignNet < 0 && totalInstNet > 0 ? '기관은 매수, 외국인은 매도 기조입니다. 환율 변동이나 글로벌 자금 흐름 변화가 외국인 매도의 원인일 수 있습니다.' : '외국인과 기관 모두 순매도 기조로, 시장 전반에 조정 압력이 있는 주간이었습니다.'}

수급 데이터는 후행 지표이므로 투자 판단 시 기업의 펀더멘털, 밸류에이션, 거시경제 환경 등을 함께 고려하시기 바랍니다.

## 관련 정보

- [실시간 주식 시세](${SITE_URL}/stock)
- [주식 블로그 글 더보기](${SITE_URL}/blog?category=stock)

---

> **면책고지**: 본 콘텐츠는 공공 데이터 기반 정보 제공 목적으로 작성되었으며, 특정 종목의 매수/매도를 권유하지 않습니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`;
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = parseInt(url.searchParams.get('limit') || '4', 10);

  const admin = getSupabaseAdmin();
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  try {
    /* fetch all March 2026 flow data */
    const { data: flowData, error: flowErr } = await admin
      .from('stock_investor_flow')
      .select('id, symbol, date, foreign_buy, foreign_sell, inst_buy, inst_sell, retail_buy, retail_sell')
      .gte('date', '2026-03-01')
      .lte('date', '2026-03-31')
      .order('date', { ascending: true });

    if (flowErr) {
      console.error('[blog-investor-flow] fetch error:', flowErr.message);
      return NextResponse.json({ ok: false, error: flowErr.message });
    }

    const rows = (flowData || []) as FlowRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, created: [], skipped: ['no data'], failed: [] });
    }

    /* group by week */
    const weekMap = new Map<number, FlowRow[]>();
    for (const r of rows) {
      const w = weekOfMonth(r.date);
      if (!weekMap.has(w)) weekMap.set(w, []);
      weekMap.get(w)!.push(r);
    }

    /* collect unique symbols for name lookup */
    const symbols = [...new Set(rows.map((r) => r.symbol))];
    const { data: quotes } = await admin
      .from('stock_quotes')
      .select('symbol, name')
      .in('symbol', symbols);

    const nameMap = new Map<string, string>();
    for (const q of (quotes || []) as QuoteLookup[]) {
      nameMap.set(q.symbol, q.name);
    }

    /* generate posts for available weeks */
    const weeks = [...weekMap.keys()].sort((a, b) => a - b).slice(offset, offset + limit);

    for (const w of weeks) {
      const slug = `investor-flow-2026-03-w${w}`;
      const title = `외국인 순매수 종목 TOP 10 \u2014 2026년 3월 ${w}주차 수급 흐름과 투자 시사점`;

      try {
        const weekRows = weekMap.get(w) || [];
        const content = buildContent(w, weekRows, nameMap);
        const tags = ['외국인수급', '기관수급', '순매수', `3월${w}주차`, '2026'];

        const result = await safeBlogInsert(admin, {
          slug,
          title,
          content: content,
          excerpt: `2026년 3월 ${w}주차 외국인/기관/개인 투자자별 순매수 종목과 수급 흐름을 분석합니다.`,
          category: 'stock',
          tags,
          cron_type: 'investor-flow',
          is_published: true,
          cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=stock&author=${encodeURIComponent('카더라')}&design=${1 + Math.floor(Math.random() * 6)}`,
          image_alt: generateImageAlt('stock', title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords('stock', tags),
        });

        if (result.success) {
          created.push(slug);
        } else {
          console.warn(`[blog-investor-flow] skip ${slug}: ${result.reason}`);
          skipped.push(slug);
        }
      } catch (e: any) {
        console.error(`[blog-investor-flow] error (${slug}):`, e.message);
        failed.push(slug);
      }
    }
  } catch (e: any) {
    console.error('[blog-investor-flow] top-level error:', e.message);
    return NextResponse.json({ ok: false, error: e.message });
  }

  return NextResponse.json({ ok: true, created, skipped, failed });
});
