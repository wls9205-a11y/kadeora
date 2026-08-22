// r4-P5-3 — /stock/domestic · /stock/overseas 공용.
//
// 최상단 2분할(국내/해외) + 시장 칩(KOSPI·KOSDAQ / NYSE·NASDAQ)까지가 최대다.
// 탭 안의 탭은 2단이 최대 — 그래서 시장별 상세는 기존 /stock/market/[code] 로 넘긴다.
//
// stale 규칙:
//   <= 1일  정상
//   1~3일   회색 "N일 전" 배지
//   > 3일   목록에서 제외 (상세 페이지는 그대로 두고 안내만 띄운다)
//
// 국내 신선도가 낮아(1,317종목 중 484종목만 1일 이내) 기본 정렬을 신선도 우선으로 둔다.
// 해외는 등락률 정렬 + 통화(USD)·한국시간 병기.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import HubHero from '@/components/detail/HubHero';
import RecordCard from '@/components/cards/v3/RecordCard';

export const DOMESTIC_MARKETS = ['KOSPI', 'KOSDAQ'] as const;
export const OVERSEAS_MARKETS = ['NYSE', 'NASDAQ'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_DROP_DAYS = 3;

export interface Quote {
  symbol: string;
  name: string | null;
  market: string | null;
  price: number | null;
  change_pct: number | null;
  currency: string | null;
  market_cap: number | null;
  updated_at: string | null;
}

export function ageInDays(updatedAt: string | null): number {
  if (!updatedAt) return Number.POSITIVE_INFINITY;
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / DAY_MS;
}

export async function fetchQuotes(markets: readonly string[], limit = 200): Promise<Quote[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('stock_quotes')
      .select('symbol, name, market, price, change_pct, currency, market_cap, updated_at')
      .eq('is_active', true)
      .gt('price', 0)
      .in('market', markets as string[])
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(1000);
    const rows = ((data ?? []) as Quote[]).filter((q) => ageInDays(q.updated_at) <= STALE_DROP_DAYS);
    return rows.slice(0, limit);
  } catch (err) {
    console.error('[stock marketGroup]', err);
    return [];
  }
}

const KST = 'Asia/Seoul';

function fmtPrice(q: Quote): string {
  if (q.price == null) return '';
  const cur = (q.currency ?? '').toUpperCase();
  if (cur === 'USD') return `$${Number(q.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${Number(q.price).toLocaleString('ko-KR')}원`;
}

function fmtPct(v: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  const n = Number(v ?? 0);
  const tone = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  return { text: `${n > 0 ? '+' : ''}${n.toFixed(2)}%`, tone };
}

function staleLabel(days: number): string {
  if (days <= 1) return '';
  return `${Math.floor(days)}일 전 기준`;
}

export interface MarketGroupPageProps {
  scope: 'domestic' | 'overseas';
  title: string;
  eyebrow: string;
  description: string;
  markets: readonly string[];
  /** 'fresh' = 신선도 우선(국내), 'change' = 등락률(해외) */
  sort: 'fresh' | 'change';
  quotes: Quote[];
}

export function MarketGroupPage({
  scope,
  title,
  eyebrow,
  description,
  markets,
  sort,
  quotes,
}: MarketGroupPageProps) {
  const rows = [...quotes].sort((a, b) => {
    if (sort === 'fresh') {
      const d = ageInDays(a.updated_at) - ageInDays(b.updated_at);
      if (Math.abs(d) > 0.04) return d;
      return (b.market_cap ?? 0) - (a.market_cap ?? 0);
    }
    return Math.abs(Number(b.change_pct ?? 0)) - Math.abs(Number(a.change_pct ?? 0));
  });

  const other = scope === 'domestic' ? '/stock/overseas' : '/stock/domestic';
  const otherLabel = scope === 'domestic' ? '해외' : '국내';
  const asOf = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  return (
    <main style={{ maxWidth: 'var(--container-grid)', margin: '0 auto', padding: 'var(--sp-md)' }}>
      <nav
        aria-label="breadcrumb"
        style={{ display: 'flex', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}
      >
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span aria-hidden="true">›</span>
        <Link href="/stock" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>주식</Link>
        <span aria-hidden="true">›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{scope === 'domestic' ? '국내' : '해외'}</span>
      </nav>

      <HubHero
        eyebrow={eyebrow}
        title={title}
        titleId="market-title"
        description={description}
        stats={[
          { label: '종목', value: rows.length.toLocaleString() },
          { label: '기준', value: `${asOf} KST` },
        ]}
        action={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {markets.map((m) => (
              <Link
                key={m}
                href={`/stock/market/${m.toLowerCase()}`}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-hover)',
                  textDecoration: 'none',
                  border: '1px solid var(--border)',
                }}
              >
                {m}
              </Link>
            ))}
            <Link
              href={other}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 700,
                color: 'var(--brand)',
                background: 'var(--brand-bg)',
                textDecoration: 'none',
                border: '1px solid var(--brand-border)',
              }}
            >
              {otherLabel} 보기
            </Link>
          </div>
        }
      />

      <section aria-labelledby="market-list" style={{ marginTop: 'var(--sp-lg)' }}>
        <h2 id="market-list" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {title} 종목 목록
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--sp-sm)' }}>
          {rows.map((q) => {
            const pct = fmtPct(q.change_pct);
            const stale = staleLabel(ageInDays(q.updated_at));
            return (
              <RecordCard
                key={q.symbol}
                href={`/stock/${encodeURIComponent(q.symbol)}`}
                title={q.name ?? q.symbol}
                meta={[q.market, q.symbol].filter(Boolean).join(' · ')}
                rows={[
                  { label: '현재가', value: fmtPrice(q) },
                  { label: '등락률', value: pct.text, tone: pct.tone },
                ]}
                caption={stale || undefined}
              />
            );
          })}
        </div>
      </section>

      <p style={{ marginTop: 'var(--sp-lg)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
        시세는 {STALE_DROP_DAYS}일 이내 갱신된 종목만 표시합니다. 그보다 오래된 종목은 목록에서 빠지지만 개별 종목
        페이지에서는 계속 확인할 수 있습니다. 투자 판단의 책임은 이용자 본인에게 있습니다.
      </p>
    </main>
  );
}
