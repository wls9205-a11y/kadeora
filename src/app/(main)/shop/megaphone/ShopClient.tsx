'use client';
import { useState } from 'react';
import type { ShopProduct } from '@/types/database';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';

const CATEGORY_LABELS: Record<string, string> = {
  megaphone: '📢 메가폰',
  badge: '🏅 뱃지',
  special: '✨ 특별',
  membership: '💎 멤버십',
};

export default function ShopClient({ products, isDemo }: { products: ShopProduct[]; isDemo: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);
  const { success, info } = useToast();

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = selectedCategory === 'all' ? products : products.filter(p => p.category === selectedCategory);
  const popular = products.filter(p => p.is_popular);

  const handleBuy = () => {
    if (!confirmProduct) return;
    success('결제 페이지로 이동합니다 (준비 중)');
    setConfirmProduct(null);
    // TODO: 토스페이먼츠 연동 후 /payment로 라우팅
  };

  const discountRate = (p: ShopProduct) => {
    if (!p.original_price || p.original_price <= p.price) return 0;
    return Math.round((1 - p.price / p.original_price) * 100);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#F1F5F9' }}>🛒 커뮤니티 상점</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>게시글 노출 및 특별 기능을 구매하세요</p>
        </div>
        {isDemo && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>💡 미리보기</span>}
      </div>

      {/* Popular section */}
      {popular.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>🔥 인기 상품</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {popular.map(p => (
              <ProductCard key={p.id} product={p} discount={discountRate(p)} onBuy={setConfirmProduct} featured />
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: selectedCategory === cat ? '#3B82F6' : '#111827',
            color: selectedCategory === cat ? 'white' : '#94A3B8',
            border: `1px solid ${selectedCategory === cat ? '#3B82F6' : '#1E293B'}`,
            transition: 'all 0.15s',
          }}>
            {cat === 'all' ? '전체' : CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* All products */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {filtered.map(p => (
          <ProductCard key={p.id} product={p} discount={discountRate(p)} onBuy={setConfirmProduct} />
        ))}
      </div>

      <ConfirmModal
        isOpen={!!confirmProduct}
        title={`${confirmProduct?.name} 구매`}
        message={`${confirmProduct?.name}을(를) ${confirmProduct?.price.toLocaleString()}원에 구매하시겠습니까?\n\n결제는 토스페이먼츠로 진행됩니다.`}
        confirmLabel="구매하기"
        onConfirm={handleBuy}
        onCancel={() => setConfirmProduct(null)}
      />
    </div>
  );
}

function ProductCard({ product: p, discount, onBuy, featured }: {
  product: ShopProduct;
  discount: number;
  onBuy: (p: ShopProduct) => void;
  featured?: boolean;
}) {
  return (
    <div style={{
      background: '#111827',
      border: `1px solid ${featured ? 'rgba(59,130,246,0.4)' : '#1E293B'}`,
      borderRadius: 14, padding: '20px 20px 16px',
      position: 'relative', transition: 'all 0.15s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#334155';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = featured ? 'rgba(59,130,246,0.4)' : '#1E293B';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {featured && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 700 }}>
          🔥 인기
        </div>
      )}
      {discount > 0 && (
        <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.15)', color: '#10B981', fontWeight: 700 }}>
          {discount}% 할인
        </div>
      )}

      <div style={{ fontSize: 36, marginBottom: 12, marginTop: discount || featured ? 24 : 0 }}>{p.icon ?? '🎁'}</div>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>{p.name}</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>{p.description}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          {p.original_price && p.original_price > p.price && (
            <div style={{ fontSize: 11, color: '#64748B', textDecoration: 'line-through', marginBottom: 2 }}>
              {p.original_price.toLocaleString()}원
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>
            {p.price.toLocaleString()}<span style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8' }}>원</span>
          </div>
        </div>
        <button
          onClick={() => onBuy(p)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#3B82F6', color: 'white',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2563EB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3B82F6')}
        >구매하기</button>
      </div>
    </div>
  );
}
