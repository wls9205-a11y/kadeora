'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

interface Plan {
  id: string;
  slug: string;
  name: string;
  price: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface Props {
  plans: Plan[];
  currentPlan: string | null;
  isLoggedIn: boolean;
}

const PLAN_COLORS: Record<string, string> = {
  free: '#64748b',
  premium: '#8b5cf6',
  pro: '#f97316',
};

const PLAN_ICONS: Record<string, string> = {
  free: '\uD83C\uDD93',
  premium: '\uD83D\uDC8E',
  pro: '\uD83D\uDE80',
};

function loadTossScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="tosspayments"]')) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://js.tosspayments.com/v2/standard';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('결제 SDK 로드 실패'));
    document.head.appendChild(s);
  });
}

export default function PremiumClient({ plans, currentPlan, isLoggedIn }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

  async function handleSubscribe(plan: Plan) {
    if (!isLoggedIn) { router.push('/login?redirect=/premium'); return; }
    if (loading) return;
    setLoading(plan.id);
    setError('');

    try {
      if (!tossClientKey) {
        setError('결제 시스템 준비 중입니다. 잠시 후 다시 시도해주세요.');
        setLoading(null);
        return;
      }

      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?redirect=/premium'); return; }

      const orderId = `SUB_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // @ts-expect-error TossPayments SDK
      if (typeof window.TossPayments === 'undefined') { await loadTossScript(); }
      // @ts-expect-error TossPayments SDK
      const tp = window.TossPayments(tossClientKey);
      const payment = tp.payment({ customerKey: user.id });

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: plan.price },
        orderId,
        orderName: `카더라 ${plan.name}`,
        successUrl: `${window.location.origin}/premium?planId=${plan.id}`,
        failUrl: `${window.location.origin}/premium?status=fail`,
        customerEmail: user.email || undefined,
      });
    } catch (err) {
      console.error(err);
      setError('결제 초기화에 실패했습니다');
    } finally {
      setLoading(null);
    }
  }

  // 토스 결제 성공 콜백 처리
  const paymentKey = searchParams.get('paymentKey');
  const tossOrderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const planId = searchParams.get('planId');

  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // 결제 승인 처리 (토스 성공 리다이렉트 후)
  if (paymentKey && tossOrderId && amount && planId && !confirmed && !confirming) {
    setConfirming(true);
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        const res = await fetch('/api/payments/subscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({ paymentKey, orderId: tossOrderId, amount: Number(amount), planId }),
        });
        const data = await res.json();
        if (data.success) {
          setConfirmed(true);
          // URL 정리 후 성공 표시
          window.history.replaceState({}, '', '/premium?status=success');
        } else {
          setError(data.error || '결제 처리에 실패했습니다');
          window.history.replaceState({}, '', '/premium?status=fail');
        }
      } catch {
        setError('결제 처리 중 오류가 발생했습니다');
        window.history.replaceState({}, '', '/premium?status=fail');
      }
      setConfirming(false);
    })();
  }

  if (confirming) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>결제 처리 중...</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>잠시만 기다려주세요</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          프리미엄 구독
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          더 깊은 투자 인사이트를 받아보세요
        </p>
      </div>

      {/* 결제 성공/실패 알림 */}
      {(status === 'success' || confirmed) && (
        <div style={{
          marginBottom: 20, padding: 16, borderRadius: 12, textAlign: 'center',
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
        }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>프리미엄 구독이 완료되었습니다!</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>새로고침하면 프리미엄 혜택이 적용됩니다.</div>
        </div>
      )}
      {status === 'fail' && (
        <div style={{
          marginBottom: 20, padding: 16, borderRadius: 12, textAlign: 'center',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>❌</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>결제에 실패했습니다</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{error || '다시 시도해주세요.'}</div>
        </div>
      )}
      {error && status !== 'fail' && (
        <div style={{
          marginBottom: 16, padding: 12, borderRadius: 10, textAlign: 'center',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          fontSize: 13, color: '#ef4444',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {plans.map((plan) => {
          const color = PLAN_COLORS[plan.slug] ?? '#8b5cf6';
          const icon = PLAN_ICONS[plan.slug] ?? '📦';
          const isCurrent = currentPlan === plan.slug;
          const features: string[] = plan.features ?? [];

          return (
            <div key={plan.id} style={{
              border: isCurrent ? `2px solid ${color}` : '1px solid var(--border)',
              borderRadius: 16, padding: 24,
              background: isCurrent ? `${color}08` : 'var(--bg-surface)',
              position: 'relative',
            }}>
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: color, color: '#fff', fontSize: 11, fontWeight: 700,
                  padding: '2px 12px', borderRadius: 999,
                }}>
                  현재 플랜
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{plan.name}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 8 }}>
                  {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                  {plan.price > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>/월</span>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {features.map((f: string, i: number) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              {plan.slug === 'free' ? (
                <div style={{
                  textAlign: 'center', padding: '10px 0', borderRadius: 10,
                  fontSize: 13, color: 'var(--text-tertiary)',
                }}>
                  기본 제공
                </div>
              ) : isCurrent ? (
                <div style={{
                  textAlign: 'center', padding: '10px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, color,
                  border: `1px solid ${color}`,
                }}>
                  이용 중
                </div>
              ) : !isLoggedIn ? (
                <Link href="/login?redirect=/premium" style={{
                  display: 'block', textAlign: 'center', padding: '10px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, color: '#fff', background: color,
                  textDecoration: 'none',
                }}>
                  로그인 후 구독
                </Link>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={!!loading}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                    fontSize: 13, fontWeight: 700, color: '#fff', background: color,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading === plan.id ? 0.7 : 1,
                  }}
                >
                  {loading === plan.id ? '처리 중...' : '프리미엄 시작하기'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 32, padding: 20, borderRadius: 12,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
          결제는 토스페이먼츠를 통해 안전하게 처리됩니다.<br />
          구독은 언제든 해지할 수 있으며, 해지 후 남은 기간까지 이용 가능합니다.<br />
          <span style={{ fontSize: 11 }}>⚠️ 현재 토스 테스트키 사용 중. 라이브 전환 시 Vercel 환경변수 교체 필요</span>
        </div>
      </div>
    </div>
  );
}
