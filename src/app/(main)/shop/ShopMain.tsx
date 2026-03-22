'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

interface Product {
  id: string; name: string; description: string; point_price: number;
  icon: string | null; purchase_type: string;
}

const CATEGORIES: { key: string; label: string; ids: string[] }[] = [
  { key: 'decor', label: '꾸미기', ids: ['custom_avatar_frame', 'profile_bg', 'emoji_pack'] },
  { key: 'activity', label: '활동', ids: ['nickname_change', 'anonymous_post', 'premium_badge', 'double_points_24h'] },
  { key: 'promo', label: '홍보', ids: ['post_boost', 'megaphone', 'pin_post'] },
  { key: 'community', label: '커뮤니티', ids: ['create_room'] },
];

export default function ShopMain() {
  const [products, setProducts] = useState<Product[]>([]);
  const [myPoints, setMyPoints] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState<string | null>(null);
  const { success, error } = useToast();
  const router = useRouter();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        const { data: p } = await sb.from('profiles').select('points').eq('id', data.session.user.id).single();
        setMyPoints(p?.points ?? 0);
      }
    });
    sb.from('shop_products').select('*').eq('is_active', true).eq('purchase_type', 'points').order('point_price')
      .then(({ data }) => { if (data) setProducts(data as Product[]); });
  }, []);

  const handleExchange = async (productId: string, price: number) => {
    if (!userId) { router.push('/login'); return; }
    if (myPoints < price) { error(`포인트가 부족합니다. ${price - myPoints}P 더 필요해요.`); return; }
    setExchanging(productId);
    try {
      const res = await fetch('/api/shop/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyPoints(data.remaining_points);
      success('교환 완료!');
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : '교환 실패');
    } finally { setExchanging(null); }
  };

  const renderCard = (p: Product) => {
    const canAfford = myPoints >= p.point_price;
    const isExchanging = exchanging === p.id;
    return (
      <div key={p.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 'var(--fs-xl)' }}>{p.icon ?? '🎁'}</div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.4, flex: 1 }}>{p.description}</div>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--brand)' }}>{p.point_price.toLocaleString()}P</div>
        <button
          onClick={() => handleExchange(p.id, p.point_price)}
          disabled={!canAfford || isExchanging}
          style={{
            padding: '7px 0', borderRadius: 10, border: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700,
            background: canAfford ? 'var(--brand)' : 'var(--bg-hover)',
            color: canAfford ? 'white' : 'var(--text-tertiary)',
            cursor: canAfford && !isExchanging ? 'pointer' : 'not-allowed',
            opacity: isExchanging ? 0.6 : 1,
          }}
        >
          {isExchanging ? '...' : canAfford ? '교환하기' : `${(p.point_price - myPoints).toLocaleString()}P 부족`}
        </button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>상점</h1>

      {/* 내 포인트 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>내 포인트</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--brand)' }}>{myPoints.toLocaleString()}P</div>
        </div>
        {!userId && (
          <button onClick={() => router.push('/login')} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--brand)', color: 'white', border: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }}>
            로그인
          </button>
        )}
      </div>

      {/* 카테고리별 상품 */}
      {CATEGORIES.map(cat => {
        const catProducts = cat.ids.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[];
        if (catProducts.length === 0) return null;
        return (
          <div key={cat.key} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{cat.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {catProducts.map(renderCard)}
            </div>
          </div>
        );
      })}

      {/* 포인트 모으는 법 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>포인트 모으는 법</div>
        글쓰기 +10P · 댓글 +5P · 출석체크 +10P · 프로필 완성 +100P
      </div>
    </div>
  );
}
