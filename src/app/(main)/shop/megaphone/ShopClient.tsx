'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import PullToRefresh from '@/components/PullToRefresh';

interface ShopProduct {
  id: string;
  name: string;
  description: string;
  price_krw: number;
  icon: string | null;
  is_active: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  megaphone: '전광판 확성기',
  etc: '기타',
};

function getCategory(id: string): string {
  if (id.startsWith('megaphone')) return 'megaphone';
  return 'etc';
}

export default function ShopClient() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);
  const { error } = useToast();
  const router = useRouter();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('shop_products').select('id,name,description,icon,price_krw,point_price,purchase_type,category,is_active,is_popular')
      .eq('is_active', true)
      .eq('purchase_type', 'cash')
      .order('price_krw')
      .then(({ data }) => {
        if (data) setProducts(data as ShopProduct[]);
        setLoading(false);
      });
  }, []);

  const categories = ['all', ...Array.from(new Set(products.map(p => getCategory(p.id))))];

  const filtered = selectedCategory === 'all' ? products : products.filter(p => getCategory(p.id) === selectedCategory);

  const handleBuy = async () => {
    if (!confirmProduct) return;
    const sb = createSupabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { error('로그인이 필요합니다'); router.push('/login?redirect=/shop/megaphone'); return; }
    router.push(`/payment?product=${confirmProduct.id}&amount=${confirmProduct.price_krw}`);
    setConfirmProduct(null);
  };

  if (loading) return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
      <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 14 }} />
    </div>
  );

  return (
    <PullToRefresh>
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 'var(--sp-2xl)' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>커뮤니티 상점</h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>게시글 홍보 및 프리미엄 기능을 이용하세요</p>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-xl)', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 'var(--fs-sm)', fontWeight: 600,
            background: selectedCategory === cat ? 'var(--brand)' : 'var(--bg-surface)',
            color: selectedCategory === cat ? 'var(--text-inverse)' : 'var(--text-secondary)',
            outline: `1px solid ${selectedCategory === cat ? 'var(--brand)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}>
            {cat === 'all' ? '전체' : CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* 상품 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="kd-card-hover" style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '20px 20px 16px',
            transition: 'all 0.15s', position: 'relative',
          }}>
            <div style={{ fontSize: 36, marginBottom: 'var(--sp-md)' }}>{p.icon ?? '🎁'}</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>
                {(p.price_krw ?? 0).toLocaleString()}
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>원</span>
              </div>
              <button onClick={() => setConfirmProduct(p)} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'var(--brand)', color: 'var(--text-inverse)',
                fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >구매하기</button>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
          현재 판매 중인 상품이 없습니다.
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'right' }}>
        ※ 결제는 토스페이먼츠로 진행됩니다. 구매 전 <a href="/terms" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>이용약관</a> 및 <a href="/refund" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>환불정책</a>을 확인해주세요.
      </p>

      <ConfirmModal
        isOpen={!!confirmProduct}
        title={`${confirmProduct?.name ?? ''} 구매`}
        message={`${confirmProduct?.name ?? ''}을(를) ${(confirmProduct?.price_krw ?? 0).toLocaleString()}원에 구매하시겠습니까?\n\n결제는 토스페이먼츠로 진행됩니다.`}
        confirmLabel="구매하기"
        onConfirm={handleBuy}
        onCancel={() => setConfirmProduct(null)}
      />
    </div>
    </PullToRefresh>
  );
}
