export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  TYPE 11 — 주요 공시 총정리 (up to 4 posts, March 2026 weeks)       */
/* ------------------------------------------------------------------ */

interface DisclosureRow {
  id: number;
  symbol: string;
  title: string;
  disclosure_type: string;
  source: string;
  url: string;
  published_at: string;
}

interface QuoteLookup {
  symbol: string;
  name: string;
}

/** Classify disclosure sentiment by type */
function sentiment(disclosureType: string, title: string): { label: string; badge: string } {
  const combined = `${disclosureType} ${title}`.toLowerCase();
  if (
    combined.includes('자사주') ||
    combined.includes('자기주식') ||
    combined.includes('배당') ||
    combined.includes('무상증자') ||
    combined.includes('액면분할')
  ) {
    return { label: '호재', badge: '🟢' };
  }
  if (
    combined.includes('유상증자') ||
    combined.includes('감자') ||
    combined.includes('상장폐지') ||
    combined.includes('횡령') ||
    combined.includes('소송')
  ) {
    return { label: '악재', badge: '🔴' };
  }
  return { label: '중립', badge: '⚪' };
}

function weekOfMonth(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.min(Math.ceil(d.getDate() / 7), 4);
}

function buildContent(
  weekNum: number,
  disclosures: DisclosureRow[],
  nameMap: Map<string, string>,
): string {
  const getName = (sym: string) => nameMap.get(sym) || sym;

  /* sentiment summary */
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  for (const d of disclosures) {
    const s = sentiment(d.disclosure_type || '', d.title || '');
    if (s.label === '호재') positive++;
    else if (s.label === '악재') negative++;
    else neutral++;
  }

  /* disclosure table rows sorted by date */
  const sorted = [...disclosures].sort(
    (a, b) => (a.published_at || '').localeCompare(b.published_at || ''),
  );

  const tableRows = sorted
    .map((d) => {
      const s = sentiment(d.disclosure_type || '', d.title || '');
      const date = (d.published_at || '').slice(0, 10);
      return `| ${date} | ${getName(d.symbol)} | ${s.badge}${s.label} | ${d.disclosure_type || '-'} | ${d.title || '-'} |`;
    })
    .join('\n');

  /* group by sentiment for cards */
  const positiveList = sorted.filter(
    (d) => sentiment(d.disclosure_type || '', d.title || '').label === '호재',
  );
  const negativeList = sorted.filter(
    (d) => sentiment(d.disclosure_type || '', d.title || '').label === '악재',
  );

  /* key takeaways */
  const typeCount: Record<string, number> = {};
  for (const d of disclosures) {
    const t = d.disclosure_type || '기타';
    typeCount[t] = (typeCount[t] || 0) + 1;
  }
  const topTypes = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return `## 2026년 3월 ${weekNum}주차 주요 공시 개요

이번 주 국내 증시에서 발표된 주요 공시를 호재/악재/중립으로 분류하여 정리합니다.

### 공시 센티먼트 요약

| 구분 | 건수 |
|------|------|
| 🟢 호재 (자사주매입, 배당 등) | ${positive}건 |
| 🔴 악재 (유상증자, 감자 등) | ${negative}건 |
| ⚪ 중립 (실적, 보고 등) | ${neutral}건 |
| **합계** | **${disclosures.length}건** |

${positive > negative ? '이번 주는 호재성 공시가 우세하여 시장에 긍정적 영향이 기대됩니다.' : negative > positive ? '악재성 공시가 많아 관련 종목의 주가 변동에 주의가 필요합니다.' : '호재와 악재가 균형을 이루고 있어 개별 종목별 분석이 중요합니다.'}

## 공시 상세 목록

| 날짜 | 기업 | 구분 | 공시유형 | 제목 |
|------|------|------|----------|------|
${tableRows || '| - | - | - | - | 해당 주차 공시 데이터 없음 |'}

${positiveList.length > 0 ? `## 🟢 호재 공시 주요 내용\n\n자사주 매입, 배당 확대 등 주주환원 성격의 공시입니다.\n\n${positiveList.slice(0, 5).map((d) => `- **${getName(d.symbol)}** — ${d.title}${d.disclosure_type ? ` (${d.disclosure_type})` : ''}`).join('\n')}\n\n자사주 매입은 기업이 자사 주가가 저평가되었다고 판단할 때 실시하는 경우가 많아, 긍정적 시그널로 해석됩니다.` : ''}

${negativeList.length > 0 ? `## 🔴 악재 공시 주의 종목\n\n유상증자, 감자 등 주가에 부정적 영향을 줄 수 있는 공시입니다.\n\n${negativeList.slice(0, 5).map((d) => `- **${getName(d.symbol)}** — ${d.title}${d.disclosure_type ? ` (${d.disclosure_type})` : ''}`).join('\n')}\n\n유상증자는 기존 주주의 지분 희석을 초래하므로 공시 내용과 자금 사용 목적을 면밀히 확인할 필요가 있습니다.` : ''}

## 공시 유형별 분포

${topTypes.map(([t, c]) => `- **${t}**: ${c}건`).join('\n') || '- 분류 데이터 없음'}

## 핵심 정리

${disclosures.length > 0 ? `이번 주 총 ${disclosures.length}건의 주요 공시가 발표되었습니다. ` : '이번 주 주요 공시 데이터가 제한적입니다. '}${positive > 0 ? `호재 공시 ${positive}건 중 자사주 매입과 배당 관련 공시가 주목할 만합니다. ` : ''}${negative > 0 ? `악재 공시 ${negative}건에 대해서는 해당 종목의 후속 공시와 주가 반응을 모니터링하시기 바랍니다.` : ''}

공시는 기업의 의무 공개 정보로, 투자 판단에 있어 가장 신뢰할 수 있는 1차 자료입니다. 정기적으로 관심 종목의 공시를 확인하는 습관을 기르시기 바랍니다.

## 관련 정보

- [실시간 주식 시세](${SITE_URL}/stock)
- [주식 블로그 글 더보기](${SITE_URL}/blog?category=stock)

---

> **면책고지**: 본 콘텐츠는 공공 데이터 기반 정보 제공 목적으로 작성되었으며, 특정 종목의 매수/매도를 권유하지 않습니다. 공시 내용의 해석은 투자자 본인의 판단에 따라야 하며, 원문 공시를 반드시 확인하시기 바랍니다.`;
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
    /* fetch all March 2026 disclosures */
    const { data: discData, error: discErr } = await admin
      .from('stock_disclosures')
      .select('id, symbol, title, disclosure_type, source, url, published_at')
      .gte('published_at', '2026-03-01')
      .lte('published_at', '2026-03-31T23:59:59')
      .order('published_at', { ascending: true });

    if (discErr) {
      console.error('[blog-disclosure] fetch error:', discErr.message);
      return NextResponse.json({ ok: false, error: discErr.message });
    }

    const rows = (discData || []) as DisclosureRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, created: [], skipped: ['no data'], failed: [] });
    }

    /* group by week */
    const weekMap = new Map<number, DisclosureRow[]>();
    for (const r of rows) {
      const w = weekOfMonth(r.published_at);
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
      const slug = `disclosure-2026-03-w${w}`;
      const title = `2026년 3월 ${w}주차 주요 공시 총정리 \u2014 자사주 매입\xB7유상증자\xB7실적 발표`;

      try {
        const weekRows = weekMap.get(w) || [];
        const content = buildContent(w, weekRows, nameMap);
        const tags = ['공시', '자사주매입', '유상증자', '실적발표', `3월${w}주차`, '2026'];

        const result = await safeBlogInsert(admin, {
          slug,
          title,
          content: ensureMinLength(content, 'stock'),
          excerpt: `2026년 3월 ${w}주차 자사주매입, 유상증자, 실적발표 등 주요 공시를 호재/악재 분류와 함께 정리합니다.`,
          category: 'stock',
          tags,
          cron_type: 'disclosure',
          is_published: true,
          cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
          image_alt: generateImageAlt('stock', title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords('stock', tags),
        });

        if (result.success) {
          created.push(slug);
        } else {
          console.warn(`[blog-disclosure] skip ${slug}: ${result.reason}`);
          skipped.push(slug);
        }
      } catch (e: any) {
        console.error(`[blog-disclosure] error (${slug}):`, e.message);
        failed.push(slug);
      }
    }
  } catch (e: any) {
    console.error('[blog-disclosure] top-level error:', e.message);
    return NextResponse.json({ ok: false, error: e.message });
  }

  return NextResponse.json({ ok: true, created, skipped, failed });
});
