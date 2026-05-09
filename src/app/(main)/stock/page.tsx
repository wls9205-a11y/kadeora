// s262 Phase C — Issue Engine v1 /stock (legacy: src/_legacy/s262/stock_page_v0.tsx)
// 7 sub-tab: 이슈/시총/급등/급락/거래폭증/외인/관심
// default = 이슈 (stock_issue_scores). 비로그인 시 6번째 카드 자리에 IssueGateCard 노출.
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import StockIssueCard from '@/components/cards/StockIssueCard';
import IssueGateCard from '@/components/cta/IssueGateCard';
import {
  getStockTone,
  stockChipStyle,
  stockBarColor,
  formatChangePct,
} from '@/lib/stockColor';
import type { StockIssueScore } from '@/lib/issue/types';

export const revalidate = 60;
export const maxDuration = 10;

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
  const tab = sp.tab ?? 'issue';
  const tabLabel = TAB_LABELS.find((t) => t.key === tab)?.label ?? '이슈';
  const title = `주식 ${tabLabel} — 카더라`;
  return {
    title,
    description: 'KOSPI·KOSDAQ 이슈 종목, 시총, 급등락, 거래폭증, 외인 매매를 한 화면에. 카더라 이슈 엔진 v1.',
    alternates: { canonical: `${SITE_URL}/stock${tab !== 'issue' ? `?tab=${tab}` : ''}` },
    openGraph: {
      title, siteName: '카더라', locale: 'ko_KR', type: 'website',
      url: `${SITE_URL}/stock`,
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
    // stock_investor_flow 최신 날짜의 (foreign_buy - foreign_sell) DESC top N
    // → join 으로 stock_quotes 메타 첨부
    const { data: flow } = await (sb as any).from('stock_investor_flow')
      .select('symbol, foreign_buy, foreign_sell, date')
      .order('date', { ascending: false })
      .order('foreign_buy', { ascending: false }).limit(limit * 2);
    const map = new Map<string, number>();
    for (const r of (flow ?? []) as { symbol: string; foreign_buy: number | null; foreign_sell: number | null }[]) {
      const net = (r.foreign_buy ?? 0) - (r.foreign_sell ?? 0);
      if (!map.has(r.symbol) || net > (map.get(r.symbol) ?? 0)) map.set(r.symbol, net);
    }
    const symbols = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map((e) => e[0]);
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
  const { kind, rows } = await fetchByTab(tab, 30);

  return (
    <Suspense>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
        <h1 className="sr-only">주식 시세 — {TAB_LABELS.find((t) => t.key === tab)?.label ?? '이슈'}</h1>

        {/* Sticky tab bar */}
        <nav
          role="tablist"
          aria-label="주식 정렬"
          style={{
            position: 'sticky', top: 44, zIndex: 10,
            display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: '8px 6px', margin: '0 -6px 8px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          {TAB_LABELS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={active}
                href={t.key === 'issue' ? '/stock' : `/stock?tab=${t.key}`}
                prefetch={false}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  background: active ? '#111827' : '#F3F4F6',
                  color: active ? '#FFFFFF' : '#374151',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {kind === 'issue' ? (
          <IssueList rows={rows as StockIssueScore[]} />
        ) : (
          <PlainList rows={rows as StockRow[]} tab={tab} />
        )}
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
      {rows.slice(0, 5).map((s) => <StockIssueCard key={s.symbol} data={s} />)}
      <IssueGateCard source="issue_gate_stock" redirect="/stock" totalCount={rows.length} />
      {rows.slice(5).map((s) => <StockIssueCard key={s.symbol} data={s} />)}
    </div>
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
      {rows.map((r) => {
        const tone = getStockTone(r.change_pct);
        const chip = stockChipStyle(tone);
        return (
          <Link
            key={r.symbol}
            href={`/stock/${r.symbol}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 9px', margin: 3, borderRadius: 6,
              background: '#FFFFFF', borderLeft: `3px solid ${stockBarColor(tone)}`,
              boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
              textDecoration: 'none', color: '#111827',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </span>
            <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{r.market}</span>
            <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: '#374151', whiteSpace: 'nowrap' }}>
              {r.price ? Number(r.price).toLocaleString() : '-'}
            </span>
            <span style={{ ...chip, padding: '1px 6px', borderRadius: 3, fontSize: 11, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatChangePct(r.change_pct)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: 16, margin: 3, borderRadius: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
      {label}
    </div>
  );
}
