'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

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
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data } = await supabase.from('shop_products').select('*').eq('is_active', true).order('price_krw', { ascending: true });
        setProducts(data || []);
        if (productId && data) { const found = data.find((p: Product) => p.id === productId); if (found) { setProduct(found); setStep('confirm'); } }
      } catch { setError('Failed to load products'); } finally { setLoading(false); }
    }
    loadProducts();
  }, [productId]);

  const handlePaymentCallback = useCallback(async () => {
    if (paymentKey && orderId && amount) {
      setStep('processing');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) { headers['Authorization'] = `Bearer ${session.access_token}`; }
        const res = await fetch('/api/payment', { method: 'POST', headers, body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), productId: productId || undefined }) });
        const data = await res.json();
        if (data.success) { setPaymentResult(data.payment); setStep('success'); } else { setError(data.error || 'Payment failed'); setStep('fail'); }
      } catch { setError('Payment processing error'); setStep('fail'); }
    }
  }, [paymentKey, orderId, amount, productId]);
  useEffect(() => { handlePaymentCallback(); }, [handlePaymentCallback]);

  const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

  async function startPayment(selectedProduct: Product) {
    setProduct(selectedProduct);
    if (!tossClientKey) { setError('결제 시스템 준비 중입니다. 잠시 후 다시 시도해주세요.'); setStep('fail'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login?redirect=/payment'); return; }
    const newOrderId = `KADEORA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      // @ts-expect-error TossPayments SDK
      if (typeof window.TossPayments === 'undefined') { await loadTossScript(); }
      // @ts-expect-error TossPayments SDK
      const tp = window.TossPayments(tossClientKey);
      const payment = tp.payment({ customerKey: user.id });
      await payment.requestPayment({ method: 'CARD', amount: { currency: 'KRW', value: selectedProduct.price_krw }, orderId: newOrderId, orderName: selectedProduct.name, successUrl: window.location.origin+'/payment?product='+selectedProduct.id, failUrl: window.location.origin+'/payment?fail=true', customerEmail: user.email || undefined });
    } catch (err) { console.error(err); setError('Payment init failed'); setStep('fail'); }
  }

  function loadTossScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="tosspayments"]')) { resolve(); return; }
      const s = document.createElement('script'); s.src = 'https://js.tosspayments.com/v2/standard';
      s.onload = () => resolve(); s.onerror = () => reject(new Error('SDK load failed')); document.head.appendChild(s);
    });
  }

  if (loading) return (<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full" /></div>);

  if (step === 'fail' || searchParams.get('fail')) return (
    <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">{'\uD83D\uDE22'}</div><h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Payment Failed</h2>
      <p className="text-[var(--text-primary)]/60 mb-6">{error || 'Payment was cancelled or an error occurred.'}</p>
      <button onClick={() => { setStep('select'); setError(''); router.push('/payment'); }} className="px-6 py-3 bg-[var(--brand)] text-white rounded-xl hover:opacity-90 transition-opacity">Try Again</button>
    </div></div>
  );

  if (step === 'processing') return (
    <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full text-center">
      <div className="animate-spin w-12 h-12 border-3 border-[var(--brand)] border-t-transparent rounded-full mx-auto mb-4" />
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Processing...</h2>
    </div></div>
  );

  if (step === 'success' && paymentResult) return (
    <div className="min-h-screen flex items-center justify-center p-4"><div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4">{'\uD83C\uDF89'}</div><h2 className="text-xl font-bold text-[var(--success)] mb-2">Payment Complete!</h2>
      <p className="text-[var(--text-primary)]/60 mb-4">{product?.name || 'Item'} purchased</p>
      <div className="bg-[var(--bg-base)] rounded-xl p-4 mb-6 text-left text-sm space-y-2">
        <div className="flex justify-between"><span className="text-[var(--text-primary)]/50">Order ID</span><span className="text-[var(--text-primary)] font-mono text-xs">{paymentResult.orderId}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-primary)]/50">Amount</span><span className="text-[var(--text-primary)] font-bold">{Number(paymentResult.amount).toLocaleString()} KRW</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-primary)]/50">Method</span><span className="text-[var(--text-primary)]">{paymentResult.method}</span></div>
      </div>
      <button onClick={() => router.push('/feed')} className="px-6 py-3 bg-[var(--brand)] text-white rounded-xl hover:opacity-90 transition-opacity">Back to Feed</button>
    </div></div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">상점</h1>
      <p className="text-[var(--text-primary)]/60 mb-6">Browse and purchase items</p>
      {step === 'confirm' && product && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full">
          <div className="text-center mb-4"><span className="text-4xl">{product.icon}</span><h3 className="text-lg font-bold text-[var(--text-primary)] mt-2">{product.name}</h3><p className="text-sm text-[var(--text-primary)]/60 mt-1">{product.description}</p></div>
          <div className="bg-[var(--bg-base)] rounded-xl p-4 mb-4 text-center"><span className="text-2xl font-bold text-[var(--brand)]">{(product.price_krw ?? 0).toLocaleString()} KRW</span></div>
          <div className="flex gap-3">
            <button onClick={() => { setStep('select'); setProduct(null); }} className="flex-1 py-3 border border-[var(--border)] text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-base)] transition-colors">Cancel</button>
            <button onClick={() => startPayment(product)} className="flex-1 py-3 bg-[var(--brand)] text-white rounded-xl hover:opacity-90 transition-opacity font-bold">Pay</button>
          </div>
        </div></div>
      )}
      {error && <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] rounded-xl p-4 mb-4">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <button key={p.id} onClick={() => { setProduct(p); setStep('confirm'); }} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 text-left hover:border-[var(--brand)]/50 transition-colors group">
            <div className="flex items-start gap-3"><span className="text-3xl">{p.icon}</span><div className="flex-1 min-w-0">
              <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">{p.name}</h3>
              <p className="text-sm text-[var(--text-primary)]/50 mt-1 line-clamp-2">{p.description}</p>
              <p className="text-lg font-bold text-[var(--brand)] mt-2">{(p.price_krw ?? 0).toLocaleString()} KRW</p>
            </div></div>
          </button>
        ))}
      </div>
      {products.length === 0 && <div className="text-center py-12 text-[var(--text-primary)]/40">No products available</div>}
    </div>
  );
}