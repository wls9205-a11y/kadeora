export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

/** Convert theme_name to a URL-safe slug (Korean spaces → dash, trim) */
function themeSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    .toLowerCase();
}

/** Format market cap for display (억 원) */
function fmtCap(cap: number | null | undefined): string {
  if (!cap) return '-';
  const eok = cap / 100_000_000;
  if (eok >= 10_000) return `${(eok / 10_000).toFixed(1)}조`;
  return `${Math.round(eok).toLocaleString()}억`;
}

/** Format price for display */
function fmtPrice(price: number | null | undefined): string {
  if (!price) return '-';
  return price.toLocaleString() + '원';
}

/** Format change_pct with arrow */
function fmtPct(pct: number | null | undefined): string {
  if (pct == null) return '-';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '-';
  return `${arrow} ${Math.abs(pct).toFixed(2)}%`;
}

/* ------------------------------------------------------------------ */
/*  main handler                                                       */
/* ------------------------------------------------------------------ */

export const GET = withCronAuth(async (req: NextRequest) => {
  const admin = getSupabaseAdmin();

  // offset / limit query params
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? 10);

  const now = new Date();
  const monthSlug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 1. Fetch themes — ALL themes ordered by date DESC, limit 10
  const { data: themes, error: thErr } = await admin
    .from('stock_themes')
    .select('id, theme_name, description, change_pct, related_symbols, is_hot, date')
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (thErr || !themes || themes.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'No themes found' });
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const theme of themes) {
    try {
      const name: string = theme.theme_name;
      const slug = `theme-stocks-${themeSlug(name)}-${monthSlug}`;

      // ----- related stock quotes -----
      const symbols: string[] = theme.related_symbols ?? [];
      let stocks: any[] = [];
      if (symbols.length > 0) {
        const { data: sq } = await admin
          .from('stock_quotes')
          .select('symbol, name, market, price, change_pct, market_cap, sector')
          .in('symbol', symbols);
        stocks = sq ?? [];
      }
      // Sort by market_cap descending for ranking
      stocks.sort((a: any, b: any) => (b.market_cap ?? 0) - (a.market_cap ?? 0));

      const stockCount = stocks.length;

      // ----- theme history -----
      const { data: history } = await admin
        .from('stock_theme_history')
        .select('id, theme_name, top_stocks, avg_change_rate, recorded_date, metadata')
        .eq('theme_name', name)
        .order('recorded_date', { ascending: false })
        .limit(30);

      // ----- build title & content -----
      const title = `2026 ${name} 테마주 TOP ${stockCount || '?'} — 수혜 종목별 시총·실적·투자 전략`;

      // -- 테마 개요 --
      const descText = theme.description
        ? theme.description
        : `${name} 테마는 최근 시장에서 주목받고 있는 투자 테마입니다. 관련 종목들의 동반 상승·하락이 빈번하게 관찰되며, 정책 변화와 산업 트렌드에 민감하게 반응합니다.`;

      let content = `## 2026 ${name} 테마주 분석\n\n`;
      content += `### \uD83D\uDD25 테마 개요\n\n`;
      content += `${descText}\n\n`;
      content += `등락률: **${theme.change_pct != null ? `${Number(theme.change_pct) > 0 ? '+' : ''}${Number(theme.change_pct).toFixed(2)}%` : '집계 중'}**\n\n`;

      // -- 관련 종목 랭킹 --
      content += `### \uD83D\uDCCA 관련 종목 랭킹\n\n`;
      if (stocks.length > 0) {
        content += `| 순위 | 종목 | 현재가 | 등락률 | 시총 |\n`;
        content += `|---|---|---|---|---|\n`;
        stocks.forEach((s: any, i: number) => {
          content += `| ${i + 1} | [${s.name}](/stock/${s.symbol}) | ${fmtPrice(s.price)} | ${fmtPct(s.change_pct)} | ${fmtCap(s.market_cap)} |\n`;
        });
        content += `\n`;
      } else {
        content += `현재 관련 종목 시세 데이터가 없습니다.\n\n`;
      }

      // -- 테마 추이 --
      content += `### \uD83D\uDCC8 테마 추이\n\n`;
      if (history && history.length > 0) {
        content += `최근 ${name} 테마의 평균 등락률 추이입니다.\n\n`;
        content += `| 날짜 | 평균 등락률 |\n`;
        content += `|---|---|\n`;
        for (const h of history.slice(0, 10)) {
          const rate = h.avg_change_rate != null ? `${Number(h.avg_change_rate) > 0 ? '+' : ''}${Number(h.avg_change_rate).toFixed(2)}%` : '-';
          content += `| ${h.recorded_date} | ${rate} |\n`;
        }
        content += `\n`;
        if (history.length >= 2) {
          const latest = Number(history[0].avg_change_rate ?? 0);
          const prev = Number(history[1].avg_change_rate ?? 0);
          const trend = latest > prev ? '상승세' : latest < prev ? '하락세' : '보합세';
          content += `최근 추이를 보면 **${trend}**를 보이고 있습니다. `;
          content += `직전 기록 대비 ${(latest - prev) > 0 ? '+' : ''}${(latest - prev).toFixed(2)}%p 변동했습니다.\n\n`;
        }
      } else {
        content += `아직 축적된 테마 추이 데이터가 부족합니다. 향후 업데이트를 통해 추이 분석이 제공될 예정입니다.\n\n`;
      }

      // -- 투자 전략 --
      content += `### \uD83D\uDD0D 투자 전략\n\n`;
      content += `**${name}** 테마에 투자할 때는 다음 사항을 고려하세요.\n\n`;
      content += `1. **테마 지속성 판단**: 단기 이슈(뉴스, 정책 발표)에 의한 급등인지, 구조적 성장 트렌드인지 구분해야 합니다. `;
      content += `구조적 테마라면 조정 시 분할 매수 전략이 유효합니다.\n\n`;
      content += `2. **대장주 vs 후발주**: 테마 내에서 시총이 가장 큰 대장주는 상대적으로 안정적이지만 상승 여력이 제한될 수 있습니다. `;
      content += `후발주는 변동성이 크지만 수익률도 높을 수 있으므로 리스크 허용 범위에 맞게 선택하세요.\n\n`;

      if (stocks.length >= 2) {
        content += `3. **분산 투자**: ${name} 테마 내 종목만으로 포트폴리오를 구성하기보다, `;
        content += `다른 섹터 종목과 함께 분산하여 테마 급락 시 리스크를 줄이세요.\n\n`;
      }

      content += `4. **손절 기준 설정**: 테마주는 모멘텀이 꺾이면 빠르게 하락할 수 있습니다. `;
      content += `진입 전 반드시 손절 기준(예: -7~10%)을 정해두세요.\n\n`;

      content += `5. **실적 확인**: 테마 수혜 기대만으로 오른 종목은 실적 시즌에 조정받을 수 있습니다. `;
      content += `실제 매출·영업이익에 테마 효과가 반영되고 있는지 확인하세요.\n\n`;

      // -- 관련 정보 --
      content += `### 관련 정보\n\n`;
      content += `- [실시간 시세 →](/stock)\n`;
      content += `- [주식 커뮤니티 →](/feed?category=stock)\n`;
      content += `- [카더라 블로그 →](/blog?category=stock)\n\n`;

      content += `---\n\n`;
      content += `> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`;

      // ----- pad & insert -----
      const finalContent = content;
      const tags = [name, '테마주', '주식', monthSlug];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content: finalContent,
        excerpt: `2026 ${name} 테마주 관련 종목 ${stockCount}개의 시총·등락률·투자 전략을 분석합니다.`,
        category: 'stock',
        tags,
        cron_type: 'blog-theme-stocks',
        data_date: now.toISOString().slice(0, 10),
        source_ref: `theme:${theme.id}`,
        is_published: true,
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&design=2&type=blog`,
        image_alt: generateImageAlt('stock', title),
        meta_description: generateMetaDesc(finalContent),
        meta_keywords: generateMetaKeywords('stock', tags),
      });

      if (result.success) {
        created++;
      } else {
        skipped++;
        if (result.reason !== 'duplicate_slug' && result.reason !== 'similar_title') {
          errors.push(`${name}: ${result.reason}`);
        }
      }
    } catch (err: any) {
      errors.push(`${theme.theme_name}: ${err.message}`);
      console.error(`[blog-theme-stocks] Error for theme "${theme.theme_name}":`, err.message);
    }
  }

  console.info(`[blog-theme-stocks] Done — created: ${created}, skipped: ${skipped}, errors: ${errors.length}`);
  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: themes.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
