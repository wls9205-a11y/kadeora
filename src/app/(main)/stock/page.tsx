// s262 Phase C — Issue Engine v1 /stock (legacy: src/_legacy/s262/stock_page_v0.tsx)
// 7 sub-tab: 이슈/시총/급등/급락/거래폭증/외인/관심
// default = 이슈 (stock_issue_scores). 비로그인 시 6번째 카드 자리에 IssueGateCard 노출.
// s262 Phase E (CAROUSEL v1): NEXT_PUBLIC_CAROUSEL_ENABLED 시 swipe carousel 모드.
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import StockIssueCardV2 from '@/components/cards/v2/StockIssueCardV2';
import IssueGateCard from '@/components/cta/IssueGateCard';
import StockTabCarousel from '@/components/carousel/StockTabCarousel';
import CurationCarousel from '@/components/ui/CurationCarousel';
import StockCurationCard from '@/components/stock/StockCurationCard';
import StockListRow from '@/components/stock/StockListRow';
import { stockTabMeta, stockItemListJsonLd } from '@/lib/seo/per-tab-meta';
import type { StockIssueScore } from '@/lib/issue/types';

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

async function fetchByTab(tab: string, limit = 30): Promise<{ kind: 'issue' | 'plain'; rows: StockIssueScore[] | StockRow[] }> {
  const sb = getSupabaseAdmin();
  if (tab === 'issue') {
    const { data } = await (sb as any)
      .from('stock_issue_scores').select('*').is('warning', null)
      .order('score', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'issue', rows: (data ?? []) as StockIssueScore[] };
  }
  // 그 외 탭은 stock_quotes 직접 query
  const baseCols = 'symbol,name,market,price,change_pct,volume,market_cap,sector';
  if (tab === 'mcap') {
    const { data } = await (sb as any).from('stock_quotes').select(baseCols)
      .eq('is_active', true).order('market_cap', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (tab === 'gain') {
    const { data } = await (sb as any).from('stock_quotes').select(baseCols)
      .eq('is_active', true).order('change_pct', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (tab === 'loss') {
    const { data } = await (sb as any).from('stock_quotes').select(baseCols)
      .eq('is_active', true).order('change_pct', { ascending: true, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (tab === 'volume') {
    const { data } = await (sb as any).from('stock_quotes').select(baseCols)
      .eq('is_active', true).order('volume', { ascending: false, nullsFirst: false }).limit(limit);
    return { kind: 'plain', rows: (data ?? []) as StockRow[] };
  }
  if (tab === 'foreign') {
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
    const { data: q } = await (sb as any).from('stock_quotes').select(baseCols)
      .in('symbol', symbols);
    const rows = (q ?? []) as StockRow[];
    rows.sort((a, b) => (map.get(b.symbol) ?? 0) - (map.get(a.symbol) ?? 0));
    return { kind: 'plain', rows };
  }
  // 'watch' 탭은 클라이언트 필요 (user 세션) — 비로그인 시 빈 배열
  return { kind: 'plain', rows: [] };
}

export default async function StockPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
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

  // Legacy single-tab UI (flag off, default)
  const { kind, rows } = await fetchByTab(tab, 30);
  return (
    <Suspense>
      <div className="kd-list">
        <div className="kd-list-main">
        <h1 className="sr-only">주식 시세 — {TAB_LABELS.find((t) => t.key === tab)?.label ?? '이슈'}</h1>

        {/* Sticky tab bar */}
        {/* s274 — 인라인 style → .kd-tabbar/.kd-tab (components.css).
            활성 상태 색은 CSS 의 [aria-selected='true'] 가 처리한다. */}
        <nav role="tablist" aria-label="주식 정렬" className="kd-tabbar">
          {TAB_LABELS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={active}
                href={t.key === 'issue' ? '/stock' : `/stock?tab=${t.key}`}
                prefetch={false}
                className="kd-tab"
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

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
          <PlainList rows={rows as StockRow[]} tab={tab} />
        )}
        </div>

        {/* v3 커밋5 · 데스크탑 우측 레일 (≥1024px). '테마' 패널은 하단 탭과 중복이라
             모바일에서는 렌더되지 않는다 (.kd-list-rail). */}
        <aside className="kd-list-rail" aria-label="주식 바로가기">
          <div className="kd-rail-panel">
            <h2>테마</h2>
            <Link href="/stock/themes">테마별 종목</Link>
            <Link href="/stock/sector/반도체">섹터 — 반도체</Link>
            <Link href="/stock/movers">급등락 상세</Link>
            <Link href="/stock/signals">시그널</Link>
          </div>
          <div className="kd-rail-panel">
            <h2>바로가기</h2>
            <Link href="/stock/compare">종목 비교</Link>
            <Link href="/stock/short-selling">공매도 현황</Link>
            <Link href="/stock/overseas">해외 증시</Link>
            <Link href="/stock/search">종목 검색</Link>
          </div>
        </aside>
      </div>
    </Suspense>
  );
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
    />
  );
}

function PlainList({ rows, tab }: { rows: StockRow[]; tab: string }) {
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
