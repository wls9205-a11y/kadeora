'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase-browser';
const createBrowserSupabaseClient = createBrowserClient;

type PaymentStep = 'select' | 'confirm' | 'processing' | 'success' | 'fail';
interface Product { id: string; name: string; description: string; price_krw: number; icon: string; is_active: boolean; }

export default function PaymentClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('product');
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const [step, setStep] = useState<PaymentStep>('select');
  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState<Record<string, string> | null>(null);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data } = await supabase.from('shop_products').select('*').eq('is_active', true).order('price_krw', { ascending: true });
        setProducts(data || []);
        if (productId && data) { const found = data.find((p: Product) => p.id === productId); if (found) { setProduct(found); setStep('confirm'); } }
      } catch { setError('상품 정보를 불러올 수 없습니다'); } finally { setLoading(false); }
    }
    loadProducts();
  }, [productId]);

  const handlePaymentCallback = useCallback(async () => {
    if (paymentKey && orderId && amount) {
      setStep('processing');
      try {
        const res = await fetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), productId: productId || undefined }) });
        const data = await res.json();
        if (data.success) { setPaymentResult(data.payment); setStep('success'); } else { setError(data.error || '결제 승인 실패'); setStep('fail'); }
      } catch { setError('결제 처리 중 오류'); setStep('fail'); }
    }
  }, [paymentKey, orderId, amount, productId]);
  useEffect(() => { handlePaymentCallback(); }, [handlePaymentCallback]);

  async function startPayment(selectedProduct: Product) {
    setProduct(selectedProduct);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login?redirect=/payment'); return; }
    const newOrderId = `KADEORA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      // @ts-expect-error TossPayments SDK
      if (typeof window.TossPayments === 'undefined') { await loadTossScript(); }
      // @ts-expect-error TossPayments SDK
      const tossPayments = window.TossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq');
      const payment = tossPayments.payment({ customerKey: user.id });
      await payment.requestPayment({ method: 'CARD', amount: { currency: 'KRW', value: selectedProduct.price_krw }, orderId: newOrderId, orderName: selectedProduct.name, successUrl: `${window.location.origin}/payment?product=${selectedProduct.id}`, failUrl: `${window.location.origin}/payment?fail=true`, customerEmail: user.email || undefined });
    } catch (err) { console.error('TossPayments error:', err); setError('결제 모듈 초기화 실패'); setStep('fail'); }
  }

  function loadTossScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="tosspayments"]')) { resolve(); return; }
      const script = document.createElement('script'); script.src = 'https://js.tosspayments.com/v2/standard';
      script.onload = () => resolve(); script.onerror = () => reject(new Error('토스 SDK 로드 실패')); document.head.appendChild(script);
    });
  }

  if (loading) return (<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-[var(--kd-primary)] border-t-transparent rounded-full" /></div>);

  if (step === 'fail' || searchParams.get('fail')) return (
    <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-[var(--kd-surface)] border border-[var(--kd-border)] rounded-2xl p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">😢</div><h2 className="text-xl font-bold text-[var(--kd-text)] mb-2">결제 실패</h2>
      <p className="text-[var(--kd-text)]/60 mb-6">{error || '결제가 취소되었거나 오류가 발생했습니다.'}</p>
      <button onClick={() => { setStep('select'); setError(''); router.push('/payment'); }} className="px-6 py-3 bg-[var(--kd-primary)] text-white rounded-xl hover:opacity-90 transition-opacity">다시 시도</button>
    </div></div>
  );

  if (step === 'processing') return (
    <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-[var(--kd-surface)] border border-[var(--kd-border)] rounded-2xl p-8 max-w-md w-full text-center">
      <div className="animate-spin w-12 h-12 border-3 border-[var(--kd-primary)] border-t-transparent rounded-full mx-auto mb-4" />
      <h2 className="text-xl font-bold text-[var(--kd-text)] mb-2">결제 승인 중...</h2><p className="text-[var(--kd-text)]/60">잠시만 기다려주세요</p>
    </div></div>
  );

  if (step === 'success' && paymentResult) return (
    <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-[var(--kd-surface)] border border-[var(--kd-border)] rounded-2xl p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">🎉</div><h2 className="text-xl font-bold text-[var(--kd-success)] mb-2">결제 완료!</h2>
      <p className="text-[var(--kd-text)]/60 mb-4">{product?.name || '상품'} 구매 완료</p>
      <div className="bg-[var(--kd-bg)] rounded-xl p-4 mb-6 text-left text-sm space-y-2">
        <div className="flex justify-between"><span className="text-[var(--kd-text)]/50">주문번호</span><span className="text-[var(--kd-text)] font-mono text-xs">{paymentResult.orderId}</span></div>
        <div className="flex justify-between"><span className="text-[var(--kd-text)]/50">결제금액</span><span className="text-[var(--kd-text)] font-bold">{Number(paymentResult.amount).toLocaleString()}원</span></div>
        <div className="flex justify-between"><span className="text-[var(--kd-text)]/50">결제수단</span><span className="text-[var(--kd-text)]">{paymentResult.method}</span></div>
      </div>
      <button onClick={() => router.push('/feed')} className="px-6 py-3 bg-[var(--kd-primary)] text-white rounded-xl hover:opacity-90 transition-opacity">피드로 돌아가기</button>
    </div></div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--kd-text)] mb-2">카더라 상점</h1>
      <p className="text-[var(--kd-text)]/60 mb-6">원하는 아이템을 구매하세요</p>
      {step === 'confirm' && product && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-[var(--kd-surface)] border border-[var(--kd-border)] rounded-2xl p-6 max-w-sm w-full">
          <div className="text-center mb-4"><span className="text-4xl">{product.icon}</span><h3 className="text-lg font-bold text-[var(--kd-text)] mt-2">{product.name}</h3><p className="text-sm text-[var(--kd-text)]/60 mt-1">{product.description}</p></div>
          <div className="bg-[var(--kd-bg)] rounded-xl p-4 mb-4 text-center"><span className="text-2xl font-bold text-[var(--kd-primary)]">{product.price_krw.toLocaleString()}원</span></div>
          <div className="flex gap-3">
            <button onClick={() => { setStep('select'); setProduct(null); }} className="flex-1 py-3 border border-[var(--kd-border)] text-[var(--kd-text)] rounded-xl hover:bg-[var(--kd-bg)] transition-colors">취소</button>
            <button onClick={() => startPayment(product)} className="flex-1 py-3 bg-[var(--kd-primary)] text-white rounded-xl hover:opacity-90 transition-opacity font-bold">결제하기</button>
          </div>
        </div></div>
      )}
      {error && <div className="bg-[var(--kd-danger)]/10 border border-[var(--kd-danger)]/30 text-[var(--kd-danger)] rounded-xl p-4 mb-4">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <button key={p.id} onClick={() => { setProduct(p); setStep('confirm'); }} className="bg-[var(--kd-surface)] border border-[var(--kd-border)] rounded-2xl p-5 text-left hover:border-[var(--kd-primary)]/50 transition-colors group">
            <div className="flex items-start gap-3"><span className="text-3xl">{p.icon}</span><div className="flex-1 min-w-0">
              <h3 className="font-bold text-[var(--kd-text)] group-hover:text-[var(--kd-primary)] transition-colors">{p.name}</h3>
              <p className="text-sm text-[var(--kd-text)]/50 mt-1 line-clamp-2">{p.description}</p>
              <p className="text-lg font-bold text-[var(--kd-primary)] mt-2">{p.price_krw.toLocaleString()}원</p>
            </div></div>
          </button>
        ))}
      </div>
      {products.length === 0 && <div className="text-center py-12 text-[var(--kd-text)]/40">판매 중인 상품이 없습니다</div>}
    </div>
  );
}
