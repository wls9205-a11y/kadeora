'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

interface WatchItem {
  item_type: string;
  item_id: string;
  item_name: string;
  price?: number;
  change_pct?: number;
}

export default function MiniWatchlist() {
  const { userId } = useAuth();
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const load = async () => {
      const sb = createSupabaseBrowser();
      const { data: rawWatchlist } = await (sb as any).from('user_watchlist')
        .select('item_type, item_id, item_name')
        .eq('user_id', userId)
        .order('display_order')
        .limit(5);

      const watchlist = (rawWatchlist || []) as { item_type: string; item_id: string; item_name: string }[];
      if (watchlist.length === 0) { setLoading(false); return; }

      // 주식 종목 시세 조회
      const stockIds = watchlist.filter(w => w.item_type === 'stock').map(w => w.item_id);
      let stockPrices: Record<string, { price: number; change_pct: number }> = {};
      if (stockIds.length > 0) {
        const { data: quotes } = await sb.from('stock_quotes')
          .select('symbol, price, change_pct')
          .in('symbol', stockIds);
        (quotes || []).forEach(q => {
          stockPrices[q.symbol] = { price: Number(q.price), change_pct: Number(q.change_pct || 0) };
        });
      }

      // 아파트 단지 시세 조회
      const aptIds = watchlist.filter(w => w.item_type === 'apt').map(w => w.item_id);
      let aptPrices: Record<string, { price: number }> = {};
      if (aptIds.length > 0) {
        const { data: apts } = await (sb as any).from('apt_complex_profiles')
          .select('complex_id, latest_sale_price')
          .in('complex_id', aptIds);
        (apts || []).forEach((a: any) => {
          aptPrices[a.complex_id] = { price: Number(a.latest_sale_price || 0) };
        });
      }

      setItems(watchlist.map(w => ({
        ...w,
        price: w.item_type === 'stock' ? stockPrices[w.item_id]?.price : aptPrices[w.item_id]?.price,
        change_pct: w.item_type === 'stock' ? stockPrices[w.item_id]?.change_pct : undefined,
      })));
      setLoading(false);
    };
    load();
  }, [userId]);

  // 비로그인 또는 관심 종목 없음 → CTA
  if (!userId) {
    return (
      <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>⭐ 관심 종목 시세를 피드에서 바로 확인하세요</span>
        <Link href="/login" style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>로그인 →</Link>
      </div>
    );
  }

  if (loading) return null;
  if (items.length === 0) {
    return (
      <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>⭐ 관심 종목을 등록하면 여기서 시세를 확인할 수 있어요</span>
        <Link href="/stock" style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>등록하기 →</Link>
      </div>
    );
  }

  const fmtPrice = (p: number, type: string) => {
    if (type === 'apt') return p >= 10000 ? `${(p / 10000).toFixed(1)}억` : `${p.toLocaleString()}만`;
    if (p >= 1000) return p.toLocaleString();
    return p < 10 ? `$${p.toFixed(2)}` : `$${Math.round(p)}`;
  };
  const pctColor = (v?: number) => !v ? 'var(--text-tertiary)' : v > 0 ? 'var(--accent-red)' : 'var(--text-brand)';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>⭐ 내 관심 종목</span>
        <Link href="/profile?tab=watchlist" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none' }}>편집</Link>
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {items.map(item => (
          <Link key={`${item.item_type}-${item.item_id}`}
            href={item.item_type === 'stock' ? `/stock/${item.item_id}` : `/apt/complex/${item.item_id}`}
            style={{ minWidth: 100, padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
            {item.price ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(item.change_pct) }}>{fmtPrice(item.price, item.item_type)}</div>
                {item.change_pct !== undefined && (
                  <div style={{ fontSize: 11, color: pctColor(item.change_pct) }}>{item.change_pct > 0 ? '+' : ''}{item.change_pct.toFixed(1)}%</div>
                )}
                {item.item_type === 'apt' && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>매매</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
