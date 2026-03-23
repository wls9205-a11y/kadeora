'use client';
import ComingSoonBanner from '@/components/ComingSoonBanner';
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
  exposure: '노출 상품',
  premium: '프리미엄',
  event: '이벤트',
};

const DEMO_PRODUCTS: ShopProduct[] = [
  { id: 'megaphone-1d', name: '확성기 1일', description: '내 게시글을 24시간 피드 상단에 고정 노출합니다', price_krw: 500, icon: '📢', is_active: true },
  { id: 'megaphone-3d', name: '확성기 3일', description: '내 게시글을 72시간 피드 상단에 고정 노출합니다', price_krw: 1200, icon: '🔊', is_active: true },
  { id: 'megaphone-7d', name: '확성기 7일', description: '내 게시글을 7일간 피드 상단에 고정 노출합니다', price_krw: 2500, icon: '📣', is_active: true },
  { id: 'badge-gold', name: '골드 뱃지', description: '프로필에 골드 뱃지를 30일간 표시합니다', price_krw: 1000, icon: '🥇', is_active: true },
  { id: 'badge-vip', name: 'VIP 뱃지', description: '프로필에 VIP 뱃지를 30일간 표시합니다', price_krw: 3000, icon: '👑', is_active: true },
];

export default function ShopClient() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);
  const { error } = useToast();
  const router = useRouter();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('shop_products').select('*').eq('is_active', true).order('price_krw')
      .then(({ data, error: err }) => {
        if (err || !data || data.length === 0) {
          setProducts(DEMO_PRODUCTS);
          setIsDemo(true);
        } else {
          setProducts(data as ShopProduct[]);
        }
      });
  }, []);

  const categories = ['all', ...Array.from(new Set(products.map(p => {
    if (p.id.startsWith('megaphone')) return 'exposure';
    if (p.id.startsWith('badge')) return 'premium';
    return 'event';
  })))];

  const filtered = selectedCategory === 'all' ? products : products.filter(p => {
    if (selectedCategory === 'exposure') return p.id.startsWith('megaphone');
    if (selectedCategory === 'premium') return p.id.startsWith('badge');
    return true;
  });

  const handleBuy = async () => {
    if (!confirmProduct) return;
    const sb = createSupabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { error('로그인이 필요합니다'); router.push('/login'); return; }
    if (isDemo) { error('현재 결제 기능은 준비 중입니다'); setConfirmProduct(null); return; }
    router.push(`/payment?product=${confirmProduct.id}&amount=${confirmProduct.price_krw}`);
    setConfirmProduct(null);
  };

  return (
    <PullToRefresh>
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      <ComingSoonBanner feature="토스페이먼츠 결제" description="사업자 등록 심사 완료 후 즉시 활성화됩니다." eta="2026년 4월 예정" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🛒 커뮤니티 상점</h1>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>게시글 노출 및 특별 기능을 구매하세요</p>
        </div>
        {isDemo && <span style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', borderRadius: 999, background: 'rgba(96,165,250,0.1)', color: 'var(--brand)', border: '1px solid rgba(96,165,250,0.3)' }}>💡 미리보기</span>}
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
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
          <div key={p.id} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '20px 20px 16px',
            transition: 'all 0.15s', position: 'relative',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>{p.icon ?? '🎁'}</div>
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

      <p style={{ marginTop: 20, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'right' }}>
        ※ 결제는 토스페이먼츠로 진행됩니다. 구매 전 이용약관을 확인해주세요.
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