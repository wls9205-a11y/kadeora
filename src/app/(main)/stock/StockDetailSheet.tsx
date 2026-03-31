'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { fmtCap, stockColor, fmt } from '@/lib/format';

const BottomSheet = dynamic(() => import('@/components/BottomSheet'), { ssr: false });

interface Stock {
  symbol: string; name: string; market: string; price: number; change_amt: number;
  change_pct: number; volume: number; market_cap: number; updated_at: string;
  currency?: string; sector?: string; description?: string;
}

interface Props {
  stock: Stock;
  onClose: () => void;
  isDomestic: boolean;
  isWatched: boolean;
  onToggleWatchlist: (symbol: string) => void;
}

export default function StockDetailSheet({ stock, onClose, isDomestic, isWatched, onToggleWatchlist }: Props) {
  return (
    <BottomSheet open={true} onClose={onClose} title={stock.name}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)' }}>
        <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{stock.symbol}</span>
        <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{stock.market}</span>
        {stock.sector && <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{stock.sector}</span>}
      </div>

      {/* 가격 + 등락 */}
      <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--text-primary)' }}>
          {stock.currency === 'USD' ? `$${stock.price?.toFixed(2)}` : `₩${fmt(stock.price)}`}
        </div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: stockColor(stock.change_pct ?? 0, isDomestic), marginTop: 'var(--sp-xs)' }}>
          {(stock.change_pct ?? 0) > 0 ? '▲' : '▼'} {stock.change_amt ? `${(stock.change_amt > 0 ? '+' : '')}${fmt(Math.abs(stock.change_amt))}` : ''} ({Math.abs(stock.change_pct ?? 0).toFixed(2)}%)
        </div>
      </div>

      {/* 상세 지표 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>시가총액</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{fmtCap(stock.market_cap, stock.currency)}</div>
        </div>
        <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>거래량</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{stock.volume ? fmt(stock.volume) : '-'}</div>
        </div>
        <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전일대비</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: stockColor(stock.change_pct ?? 0, isDomestic), marginTop: 2 }}>{stock.change_amt ? `${stock.change_amt > 0 ? '+' : ''}${fmt(stock.change_amt)}` : '-'}</div>
        </div>
      </div>

      {/* 관심종목 + 상세 버튼 */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
        <button onClick={() => onToggleWatchlist(stock.symbol)} style={{ flex: 1, padding: 12, borderRadius: 'var(--radius-sm)', border: `1px solid ${isWatched ? 'var(--accent-yellow)' : 'var(--border)'}`, background: isWatched ? 'rgba(251,191,36,0.08)' : 'var(--bg-hover)', color: isWatched ? '#D97706' : 'var(--text-secondary)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}>
          {isWatched ? '★ 관심 해제' : '☆ 관심 추가'}
        </button>
        <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDomestic ? 'var(--brand)' : 'var(--accent-blue)', color: 'var(--text-inverse)', padding: 12, borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
          종목 상세 →
        </Link>
      </div>
    </BottomSheet>
  );
}
