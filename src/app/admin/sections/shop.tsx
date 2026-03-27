'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge, C, DataTable, Pill, Spinner, ago, fmt } from '../admin-shared';

export default function ShopSection() {
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 16px' }}>🛍️ 상점</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <Pill active={tab === 'products'} onClick={() => setTab('products')}>📦 상품 관리</Pill>
        <Pill active={tab === 'orders'} onClick={() => setTab('orders')}>🧾 주문 내역</Pill>
      </div>
      {tab === 'products' && <ProductsTab />}
      {tab === 'orders' && <OrdersTab />}
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/shop').then(r => r.json()).then(d => setProducts(d.products || [])).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const toggleActive = async (id: string, active: boolean) => {
    await fetch('/api/admin/shop', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: active }),
    });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: active } : p));
  };

  if (loading) return <Spinner />;

  return (
    <DataTable
      headers={['상품명', '카테고리', '가격', '포인트', '인기', '상태', '조치']}
      rows={products.map(p => [
        <div key="n">
          <div style={{ fontWeight: 600 }}>{p.icon} {p.name}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{p.description?.slice(0, 40)}</div>
        </div>,
        p.category || '—',
        p.price_krw ? `${p.price_krw.toLocaleString()}원` : '—',
        p.point_price ? `${p.point_price.toLocaleString()}P` : '—',
        p.is_popular ? <Badge key="pop" color={C.yellow}>인기</Badge> : '—',
        p.is_active ? <Badge key="s" color={C.green}>활성</Badge> : <Badge key="s" color={C.textDim}>비활성</Badge>,
        <button key="a" onClick={() => toggleActive(p.id, !p.is_active)} style={{
          padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          background: p.is_active ? C.redBg : C.greenBg, color: p.is_active ? C.red : C.green,
        }}>{p.is_active ? '비활성화' : '활성화'}</button>,
      ])}
    />
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/shop?type=orders').then(r => r.json()).then(d => setOrders(d.orders || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s: number, o: any) => s + (o.amount || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: 11, color: C.textDim }}>총 주문</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.brand }}>{orders.length}건</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: 11, color: C.textDim }}>총 매출</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{totalRevenue.toLocaleString()}원</div>
        </div>
      </div>
      <DataTable
        headers={['주문일', '유저', '상품', '금액', '결제방식', '상태']}
        rows={orders.map(o => [
          ago(o.created_at),
          o.user_id?.slice(0, 8) || '—',
          o.product_id || '—',
          <span key="a" style={{ fontWeight: 700 }}>{(o.amount || 0).toLocaleString()}원</span>,
          o.method || '—',
          <Badge key="s" color={o.status === 'completed' ? C.green : o.status === 'pending' ? C.yellow : C.red}>{o.status}</Badge>,
        ])}
      />
    </div>
  );
}
