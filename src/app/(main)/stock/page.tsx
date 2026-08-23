// s262 Phase C — Issue Engine v1 /stock
// (v8-A1: 이전 UI 스냅샷 _legacy/s262/stock_page_v0.tsx + StockClient + TrendingKeywords 삭제.
//  셋이 사슬로 물려 도달 불가 사문이었다 — 필요하면 git history 에서 꺼낸다.)
// 7 sub-tab: 이슈/시총/급등/급락/거래폭증/외인/관심
// default = 이슈 (stock_issue_scores). 비로그인 시 6번째 카드 자리에 IssueGateCard 노출.
// s262 Phase E (CAROUSEL v1): NEXT_PUBLIC_CAROUSEL_ENABLED 시 swipe carousel 모드.
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import StockIssueCardV2 from '@/components/cards/v2/StockIssueCardV2';
import IssueGateCard from '@/components/cta/IssueGateCard';
import StockTabCarousel from '@/components/carousel/StockTabCarousel';
import CurationCarousel from '@/components/ui/CurationCarousel';
import StockCurationCard from '@/components/stock/StockCurationCard';
import StockListRow from '@/components/stock/StockListRow';
import StockFilterBars from '@/components/stock/StockFilterBars';
import StockIndexStrip, { type StripData, type MarketBreadth } from '@/components/stock/StockIndexStrip';
import StockHubRail, { type MoverRow } from '@/components/stock/StockHubRail';
import { stockTabMeta, stockItemListJsonLd } from '@/lib/seo/per-tab-meta';
import type { StockIssueScore } from '@/lib/issue/types';
import {
  resolveParams, marketValues, sortLabel, marketLabel,
  type StockParams,
} from '@/lib/stock/filters';

export const revalidate = 60;
export const maxDuration = 10;

const CAROUSEL_ENABLED = process.env.NEXT_PUBLIC_CAROUSEL_ENABLED === 'true';

const TAB_LABELS: { key: string; label: string }[] = [
  { key: 'issue',   label: '이슈' },
  { key: 'mcap',    label: '시총' },
  { key: 'gain',    label: '급등' },
  { key: 'loss',    label: '급락' },
  { key: 'volume',  label: '거래폭증' },
  { key: 'foreign', label: '외인' },
  { key: 'watch',   label: '관심' },
];

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ tab?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const m = stockTabMeta(sp.tab);
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: m.canonical },
    ...(m.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: m.title,
      description: m.description,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      url: m.canonical,
      // s8: images 누락으로 공유 시 이미지 없는 링크로 나갔다. 기존 생성기 재사용.
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(m.title)}&category=stock&design=2`, width: 1200, height: 630, alt: m.title }],
    },
  };
}

type StockRow = {
  symbol: string;
  name: string;
  market: string | null;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap?: number | null;
  sector?: string | null;
};

/**
 * v7-C2 — 상단 지수 스트립 데이터.
 *
 * ⚠️ 코스피·코스닥 지수 레벨은 DB 에 없다 (적재 테이블·크론 자체가 없다).
 *    없는 값을 지어내지 않고, 같은 화면에서 실제로 답할 수 있는 등락 종목 수를 낸다.
 *
 * 활성 1,805행 × (market, change_pct) 2컬럼이라 가볍고, revalidate=60 이라
 * 분당 1회로 묶인다. Rule #15 — count 쿼리를 쓰지 않는다 (stock_quotes 는 1,846행이라
 * exact count 허용 범위 밖이다). 행을 받아 JS 에서 센다.
 */
async function fetchStrip(): Promise<StripData> {
  const empty: MarketBreadth = { up: 0, down: 0, flat: 0, avg: null };
  const out: StripData = { kospi: { ...empty }, kosdaq: { ...empty }, usdkrw: null, usdkrwAt: null };
  try {
    const sb = getSupabaseAdmin();
    const [quotesR, fxR] = await Promise.all([
      (sb as any).from('stock_quotes').select('market, change_pct').eq('is_active', true),
      (sb as any).from('exchange_rates').select('rates, updated_at').eq('base_currency', 'USD')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const sums: Record<string, { n: number; total: number }> = {
      KOSPI: { n: 0, total: 0 },
      KOSDAQ: { n: 0, total: 0 },
    };
    for (const r of ((quotesR?.data ?? []) as { market: string | null; change_pct: number | null }[])) {
      const key = r.market === 'KOSPI' ? 'kospi' : r.market === 'KOSDAQ' ? 'kosdaq' : null;
      if (!key) continue;
      const v = Number(r.change_pct);
      const b = out[key];
      if (!Number.isFinite(v) || v === 0) b.flat++;
      else if (v > 0) b.up++;
      else b.down++;
      if (Number.isFinite(v)) {
        const acc = sums[r.market as string];
        acc.n++;
        acc.total += v;
      }
    }
    out.kospi.avg = sums.KOSPI.n > 0 ? sums.KOSPI.total / sums.KOSPI.n : null;
    out.kosdaq.avg = sums.KOSDAQ.n > 0 ? sums.KOSDAQ.total / sums.KOSDAQ.n : null;

    const krw = Number((fxR?.data?.rates as Record<string, unknown> | undefined)?.KRW);
    if (Number.isFinite(krw) && krw > 0) {
      out.usdkrw = krw;
      out.usdkrwAt = fxR?.data?.updated_at ?? null;
    }
  } catch {
    /* 스트립이 실패해도 목록은 그대로 렌더된다 */
  }
  return out;
}

/**
 * v7-C3 — 레일용 급등·급락 각 4건. 전체 시장 기준이라 본문 필터와 무관하게 고정이다
 * (레일은 '지금 시장이 어떤가' 를 답하는 자리다).
 */
async function fetchMovers(): Promise<{ gainers: MoverRow[]; losers: MoverRow[] }> {
  try {
    const sb = getSupabaseAdmin();
    const cols = 'symbol,name,change_pct';
    const [up, down] = await Promise.all([
      (sb as any).from('stock_quotes').select(cols).eq('is_active', true)
        .order('change_pct', { ascending: false, nullsFirst: false }).limit(4),
      (sb as any).from('stock_quotes').select(cols).eq('is_active', true)
        .order('change_pct', { ascending: true, nullsFirst: false }).limit(4),
    ]);
    return {
      gainers: (up?.data ?? []) as MoverRow[],
      losers: (down?.data ?? []) as MoverRow[],
    };
  } catch {
    return { gainers: [], losers: [] };
  }
}

/** v7-C1 — 테마 칩 목록. 최신 날짜 · is_hot 우선 · 12개. 실패하면 빈 배열(줄이 사라진다). */
async function fetchThemeNames(): Promise<string[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data: latest } = await (sb as any)
      .from('stock_themes').select('date').order('date', { ascending: false }).limit(1).maybeSingle();
    if (!latest?.date) return [];
    const { data } = await (sb as any)
      .from('stock_themes')
      .select('theme_name, is_hot')
      .eq('date', latest.date)
      .order('is_hot', { ascending: false })
      .limit(12);
    return Array.from(new Set(((data ?? []) as { theme_name: string }[]).map((t) => t.theme_name).filter(Boolean)));
  } catch {
    return [];
  }
}

/**
 * v7-C1 — 테마에 속한 심볼. stock_themes 는 하루 한 벌 갱신되고 테마당 3~7종목이다.
 * 테마를 안 고르면 조회하지 않는다. 실패하면 null 을 돌려 필터를 걸지 않는다
 * (테마 조회 실패가 목록 전체를 비우면 안 된다).
 */
async function themeSymbols(theme: string): Promise<string[] | null> {
  if (!theme) return null;
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('stock_themes')
      .select('related_symbols, date')
      .eq('theme_name', theme)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const syms = Array.isArray(data?.related_symbols) ? (data.related_symbols as string[]) : [];
    return syms.length > 0 ? syms : null;
  } catch {
    return null;
  }
}

/**
 * v7-C1: 시장 × 정렬(× 테마) 2축 조회.
 *
 * 시장은 stock_issue_scores·stock_quotes 양쪽에 market 컬럼이 있어 같은 방식으로 걸린다.
 * 실측값은 KOSPI / KOSDAQ / NYSE / NASDAQ 4종뿐이라 해외 = NYSE+NASDAQ 이다.
 */
async function fetchStocks(
  params: StockParams,
  limit = 30,
): Promise<{ kind: 'issue' | 'plain'; rows: StockIssueScore[] | StockRow[] }> {
  const sb = getSupabaseAdmin();
  const { sort, theme } = params;
  const markets = marketValues(params.market);
  const syms = await themeSymbols(theme);

  /** 두 테이블에 같은 방식으로 붙는 공통 필터. */
  const applyFilters = (q: any) => {
    let out = q;
    if (markets) out = out.in('market', markets);
    if (syms) out = out.in('symbol', syms);
    return out;
  };

  if (sort === 'issue') {
    let q = (sb as any).from('stock_issue_scores').select('*').is('warning', null);
    q = applyFilters(q);
    const { data } = await q.order('score', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'issue', rows: (data ?? []) as StockIssueScore[] };
  }

  const baseCols = 'symbol,name,market,price,change_pct,volume,market_cap,sector';
  const quotes = () => applyFilters((sb as any).from('stock_quotes').select(baseCols).eq('is_active', true));

  if (sort === 'mcap') {
    const { data } = await quotes().order('market_cap', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (sort === 'gain') {
    const { data } = await quotes().order('change_pct', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (sort === 'loss') {
    const { data } = await quotes().order('change_pct', { ascending: true, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (sort === 'volume') {
    const { data } = await quotes().order('volume', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (sort === 'foreign') return fetchForeign(sb, limit, markets, syms);
  // 'watch' 는 클라이언트 세션이 필요하다 — 비로그인 시 빈 배열
  return { kind: 'plain', rows: [] };
}

/** 레거시 탭 프리페치용 (캐러셀 모드에서만 쓴다). */
async function fetchByTab(tab: string, limit = 30): Promise<{ kind: 'issue' | 'plain'; rows: StockIssueScore[] | StockRow[] }> {
  return fetchStocks({ market: 'all', sort: tab as StockParams['sort'], theme: '' }, limit);
}

async function fetchForeign(
  sb: ReturnType<typeof getSupabaseAdmin>,
  limit: number,
  markets: readonly string[] | null,
  syms: string[] | null,
): Promise<{ kind: 'issue' | 'plain'; rows: StockIssueScore[] | StockRow[] }> {
  const baseCols = 'symbol,name,market,price,change_pct,volume,market_cap,sector';

    // s274 정확성 수정.
    //
    // 이전 구현은 날짜 필터 없이 date DESC 로 limit*2(=60) 행을 가져왔다.
    // stock_investor_flow 는 하루 10행만 쌓이므로 그 60행은 실제로 6영업일치가
    // 섞인 집합이었고, map 이 심볼별 '여러 날 중 최대 net' 을 골라서
    // "오늘 외국인 순매수" 라는 라벨과 다른 값을 보여주고 있었다.
    // 정렬 키도 net 이 아니라 foreign_buy(총매수) 였다 — 매수·매도가 둘 다 큰
    // 종목이 상위를 차지하고 실제 순매수 종목이 밀려났다.
    //
    // 최신 날짜를 먼저 찾고 그 날짜만 조회한다. 하루 10행이라 전량 가져와
    // net 정렬이 근사 없이 정확하다.
    const { data: latest } = await (sb as any).from('stock_investor_flow')
      .select('date').order('date', { ascending: false }).limit(1).maybeSingle();
    if (!latest?.date) return { kind: 'plain', rows: [] };

    const { data: flow } = await (sb as any).from('stock_investor_flow')
      .select('symbol, foreign_buy, foreign_sell')
      .eq('date', latest.date)
      .limit(limit);
    // 탭 이름이 '외국인 순매수 상위' 이므로 순매도(net<=0) 종목은 넣지 않는다.
    // 예: 2026-08-07 기준 000660 은 net -100,000 인데 구현 결함 탓에 순매수
    // 2위로 표시되고 있었다. 건수가 적어지더라도 틀린 부호를 보이는 것보다 낫다.
    //
    // 참고: stock_investor_flow 는 하루 10행만 적재되므로 이 탭은 구조적으로
    // 최대 10종목이다. 더 넓히려면 수집 크론 쪽을 손봐야 한다.
    const map = new Map<string, number>();
    for (const r of (flow ?? []) as { symbol: string; foreign_buy: number | null; foreign_sell: number | null }[]) {
      const net = (r.foreign_buy ?? 0) - (r.foreign_sell ?? 0);
      if (net > 0) map.set(r.symbol, net);
    }
    const symbols = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    if (symbols.length === 0) return { kind: 'plain', rows: [] };
    // v7-C1: 시장·테마 필터를 여기에도 건다. 안 걸면 '코스닥 + 외인' 이 전체 결과를 준다.
    let qq = (sb as any).from('stock_quotes').select(baseCols).in('symbol', symbols);
    if (markets) qq = qq.in('market', markets);
    if (syms) qq = qq.in('symbol', syms);
    const { data: q } = await qq;
  const rows = (q ?? []) as StockRow[];
  rows.sort((a, b) => (map.get(b.symbol) ?? 0) - (map.get(a.symbol) ?? 0));
  return { kind: 'plain', rows };
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; market?: string; sort?: string; theme?: string }>;
}) {
  const sp = await searchParams;
  // v7-C1: ?market= ?sort= ?theme= 3축. 기존 ?tab= 은 sort 로 매핑해 계속 받는다
  //   (색인·북마크가 걸려 있다).
  const params = resolveParams(sp);
  const tab = (sp.tab ?? 'issue') as string;

  // s262 Phase E: CAROUSEL 모드 — 7 탭 모두 prefetch + Embla carousel
  if (CAROUSEL_ENABLED) {
    const allResults = await Promise.all(TAB_LABELS.map((t) => fetchByTab(t.key, 30)));
    const initialIdx = Math.max(0, TAB_LABELS.findIndex((t) => t.key === tab));
    const issueRows = (allResults[0]?.rows ?? []) as StockIssueScore[];
    const itemListJsonLd = stockItemListJsonLd('이슈', issueRows.slice(0, 5));
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
        <h1 className="sr-only">주식 시세 — 이슈 캐러셀</h1>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
        <StockTabCarousel tabs={TAB_LABELS} initialIndex={initialIdx} paramDefault="issue" trackSource="stock_carousel">
          {TAB_LABELS.map((t, i) => {
            const r = allResults[i];
            if (!r) return <Empty key={t.key} label="데이터 준비 중" />;
            if (r.kind === 'issue') {
              const issues = r.rows as StockIssueScore[];
              if (issues.length === 0) return <Empty key={t.key} label="이슈 종목 데이터 준비 중" />;
              return (
                <div key={t.key}>
                  {issues.slice(0, 5).map((s) => <StockIssueCardV2 key={s.symbol} data={s} />)}
                  <IssueGateCard source="issue_gate_stock" redirect="/stock" totalCount={issues.length} />
                  {issues.slice(5).map((s) => <StockIssueCardV2 key={s.symbol} data={s} />)}
                </div>
              );
            }
            return <PlainList key={t.key} rows={r.rows as StockRow[]} tab={t.key} />;
          })}
        </StockTabCarousel>
      </div>
    );
  }

  // 기본 UI (캐러셀 플래그 off)
  const [{ kind, rows }, themes, strip, movers] = await Promise.all([
    fetchStocks(params, 30),
    fetchThemeNames(),
    fetchStrip(),
    fetchMovers(),
  ]);
  // 이슈 탭은 행에 sparkline_5d 가 이미 있어 추가 조회를 하지 않는다.
  const sparks =
    kind === 'plain'
      ? await fetchSparklines((rows as StockRow[]).map((r) => r.symbol))
      : {};
  return (
    <Suspense>
      <div className="kd-list">
        <div className="kd-list-main">
        <h1 className="sr-only">
          {marketLabel(params.market)} 주식 — {sortLabel(params.sort)}
          {params.theme ? ` · ${params.theme}` : ''}
        </h1>

        {/* v7-C2: 지수 스트립 3칸 한 줄 */}
        <StockIndexStrip data={strip} />

        {/* v7-C1: 단일 축 탭 7개 → 시장 × 정렬 2축 (+ 테마 선택) */}
        <StockFilterBars params={params} themes={themes} />

        {/* v3 커밋5 · 큐레이션 3건 — 이슈 탭에서만. 점수의 근거를 여기서 편다. */}
        {kind === 'issue' && (rows as StockIssueScore[]).length > 0 && (
          <CurationCarousel
            title="지금 이슈 상위"
            items={(rows as StockIssueScore[]).slice(0, 3).map((s) => (
              <StockCurationCard key={s.symbol} data={s} />
            ))}
          />
        )}

        {kind === 'issue' ? (
          <IssueList rows={rows as StockIssueScore[]} />
        ) : (
          <PlainList rows={rows as StockRow[]} tab={tab} sparks={sparks} />
        )}
        </div>

        {/* v7-C3 · 데스크탑 우측 레일 (≥1024px). 전역 RightPanel 대체 —
             레일은 페이지가 소유한다 (/apt 의 AptHubRail 과 같은 패턴).
             ①시장 지수 ②급등·급락 ③테마 ④바로가기. */}
        <aside className="kd-list-rail" aria-label="주식 요약">
          <StockHubRail
            params={params}
            strip={strip}
            gainers={movers.gainers}
            losers={movers.losers}
            themes={themes}
          />
        </aside>
      </div>
    </Suspense>
  );
}

/**
 * v4-C7-3: 목록 좌측 스파크라인용 최근 종가.
 *
 * 이슈 탭은 stock_issue_scores.sparkline_5d 가 이미 행에 실려 있어 조회가 필요 없다.
 * 그 외 탭(stock_quotes 기반)은 이력이 없으므로 여기서 한 번만 가져온다.
 *
 * Rule #15 — count 쿼리 없음. Rule #16 — 이 라우트는 maxDuration=10 이 이미 걸려 있다.
 * 30심볼 × 최대 7행이라 .in() 한 번으로 끝난다. 실패하면 스파크라인만 빠지고
 * 목록은 그대로 렌더된다 (좌측 칸은 평평한 선으로 자리를 지킨다).
 */
async function fetchSparklines(symbols: string[]): Promise<Record<string, number[]>> {
  if (symbols.length === 0) return {};
  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const { data } = await (sb as any)
      .from('stock_price_history')
      .select('symbol, date, close_price')
      .in('symbol', symbols)
      .gte('date', since)
      .order('date', { ascending: true });

    const out: Record<string, number[]> = {};
    for (const r of (data ?? []) as { symbol: string; close_price: number | null }[]) {
      const v = Number(r.close_price);
      if (!Number.isFinite(v)) continue;
      (out[r.symbol] ??= []).push(v);
    }
    // 최근 7거래일만 남긴다 — 14일 창은 휴장일을 감안한 여유다.
    for (const k of Object.keys(out)) out[k] = out[k].slice(-7);
    return out;
  } catch {
    return {};
  }
}

function IssueList({ rows }: { rows: StockIssueScore[] }) {
  if (rows.length === 0) {
    return <Empty label="이슈 종목 데이터 준비 중" />;
  }
  // 5번째 다음 IssueGateCard 삽입 — 비로그인일 때만 실제 렌더 (컴포넌트 내부에서 useAuth 체크).
  // 로그인 사용자에게는 6번째 카드부터 정상 노출.
  return (
    <div>
      <div className="kd-lhead" aria-hidden="true">
        <span>점수</span>
        <span>종목 · 이슈 근거</span>
        <span>현재가</span>
      </div>
      {rows.slice(0, 5).map((s) => <IssueRow key={s.symbol} data={s} />)}
      <IssueGateCard source="issue_gate_stock" redirect="/stock" totalCount={rows.length} />
      {rows.slice(5).map((s) => <IssueRow key={s.symbol} data={s} />)}
    </div>
  );
}

function IssueRow({ data }: { data: StockIssueScore }) {
  return (
    <StockListRow
      symbol={data.symbol}
      name={data.name}
      price={data.price}
      changePct={data.change_pct}
      score={data.score}
      reasons={data.reasons}
      warning={data.warning}
      meta={data.sector}
      spark={data.sparkline_5d}
    />
  );
}

function PlainList({ rows, tab, sparks }: { rows: StockRow[]; tab: string; sparks?: Record<string, number[]> }) {
  if (rows.length === 0) {
    return (
      <Empty label={tab === 'watch' ? '로그인하면 관심 종목을 볼 수 있어요' : '데이터 준비 중'} />
    );
  }
  return (
    <div>
      <div className="kd-lhead" aria-hidden="true">
        <span>순위</span>
        <span>종목</span>
        <span>현재가</span>
      </div>
      {rows.map((r, i) => (
        <StockListRow
          key={r.symbol}
          symbol={r.symbol}
          name={r.name}
          price={r.price}
          changePct={r.change_pct}
          rank={i + 1}
          meta={r.sector ?? null}
          spark={sparks?.[r.symbol] ?? null}
        />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="kd-empty">
      {label}
    </div>
  );
}
