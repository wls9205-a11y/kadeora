import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { fmtCap, stockColor, fmtPrice } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 3600;

interface Props { params: Promise<{ name: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const sector = decodeURIComponent(name);
  return {
    title: `${sector} 섹터 종목 | 카더라`,
    description: `${sector} 섹터에 속한 주식 종목 목록. 시가총액, 등락률, 거래량 비교. 카더라에서 실시간 시세를 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}` },
    openGraph: {
      title: `${sector} 섹터 종목`,
      description: `${sector} 관련 주식 시세, 시총 순위, 등락률 비교`,
      url: `${SITE_URL}/stock/sector/${encodeURIComponent(sector)}`,
    },
  };
}

export default async function SectorPage({ params }: Props) {
  const { name } = await params;
  const sector = decodeURIComponent(name);
  const sb = await createSupabaseServer();

  const { data: stocks } = await sb.from('stock_quotes')
    .select('symbol, name, market, price, change_pct, change_amt, volume, market_cap, currency, sector, updated_at')
    .eq('sector', sector)
    .gt('price', 0)
    .order('market_cap', { ascending: false });

  if (!stocks?.length) notFound();

  const isKR = stocks[0]?.market === 'KOSPI' || stocks[0]?.market === 'KOSDAQ';
  const totalCap = stocks.reduce((s, st) => s + (st.market_cap || 0), 0);
  const avgPct = stocks.reduce((s, st) => s + (st.change_pct || 0), 0) / stocks.length;
  const upCount = stocks.filter(s => (s.change_pct || 0) > 0).length;
  const downCount = stocks.filter(s => (s.change_pct || 0) < 0).length;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/stock" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 주식</Link>
        <h1 style={{ margin: '8px 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{sector} 섹터</h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          {stocks.length}종목 · 합산 시총 {fmtCap(totalCap, stocks[0]?.currency ?? undefined)} · 평균 등락 {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(2)}%
        </p>
      </div>

      {/* 섹터 요약 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: isKR ? 'var(--accent-red)' : 'var(--accent-green)' }}>{upCount}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>상승</div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-tertiary)' }}>{stocks.length - upCount - downCount}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>보합</div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: isKR ? 'var(--accent-blue)' : 'var(--accent-red)' }}>{downCount}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>하락</div>
        </div>
      </div>

      {/* 종목 리스트 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px' }}>
        {stocks.map((s, i) => {
          const pct = s.change_pct ?? 0;
          return (
            <Link key={s.symbol} href={`/stock/${encodeURIComponent(s.symbol)}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px',
              borderBottom: i < stocks.length - 1 ? '1px solid var(--border)' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 18, textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.symbol} · {fmtCap(s.market_cap, s.currency ?? undefined)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmtPrice(s.price ?? 0, s.currency ?? undefined)}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: stockColor(pct, isKR) }}>
                  {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 다른 섹터 링크 */}
      <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 다른 섹터</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['반도체', '금융', '자동차', '바이오', '화학', '철강', '건설', '유통', 'IT', '에너지', '통신', '엔터', '방산', '조선'].map(s => (
            <Link key={s} href={`/stock/sector/${encodeURIComponent(s)}`} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 500,
              background: s === sector ? 'var(--brand)' : 'var(--bg-hover)',
              color: s === sector ? 'var(--text-inverse)' : 'var(--text-secondary)',
              textDecoration: 'none', border: '1px solid var(--border)',
            }}>{s}</Link>
          ))}
        </div>
      </div>

      <Disclaimer type="stock" compact />
    </div>
  );
}
