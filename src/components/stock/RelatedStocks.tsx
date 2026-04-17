import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

/**
 * 유사 종목 추천 섹션
 * 같은 섹터 + 시가총액 유사 종목 6개 표시
 * 종목 상세 페이지 하단에 삽입
 */

interface Props {
  symbol: string;
  sector: string | null;
  market: string | null;
  marketCap: number | null;
}

export default async function RelatedStocks({ symbol, sector, market, marketCap }: Props) {
  const sb = await createSupabaseServer();

  // 같은 섹터 종목 (시가총액 유사)
  let query = sb.from('stock_quotes')
    .select('symbol, name, price, change_pct, market_cap, sector, market, logo_url')
    .neq('symbol', symbol)
    .eq('is_active', true)
    .gt('price', 0)
    .order('market_cap', { ascending: false })
    .limit(30);

  if (sector) query = query.eq('sector', sector);
  else if (market) query = query.eq('market', market);

  const { data: candidates } = await query;
  if (!candidates?.length) return null;

  // 시가총액 기준 가장 유사한 6개 선택
  const cap = marketCap || 0;
  const sorted = [...(candidates as any[])].sort((a, b) =>
    Math.abs((a.market_cap || 0) - cap) - Math.abs((b.market_cap || 0) - cap)
  ).slice(0, 6);

  if (!sorted.length) return null;

  return (
    <section style={{ marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
        🔗 유사 종목
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '8px',
      }}>
        {sorted.map((s: any) => {
          const pct = Number(s.change_pct ?? 0);
          return (
            <Link
              key={s.symbol}
              href={`/stock/${s.symbol}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md, 8px)',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                {s.name}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {s.symbol}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                marginTop: '4px',
                color: pct >= 0 ? '#ef4444' : '#3b82f6',
              }}>
                {Number(s.price).toLocaleString()}
                <span style={{ fontSize: '11px', marginLeft: '4px' }}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
