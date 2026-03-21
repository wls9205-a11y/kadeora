import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '프리미엄 구독',
  description: '카더라 프리미엄으로 더 많은 정보를 받아보세요',
  openGraph: {
    title: '프리미엄 | 카더라',
    description: '프리미엄으로 더 깊은 투자 인사이트를 받아보세요',
    images: [{ url: 'https://kadeora.app/images/brand/kadeora-full.png', alt: '카더라 프리미엄' }],
  },
};

export default async function PremiumPage() {
  const sb = await createSupabaseServer();
  const { data: plans } = await sb
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  const { data: { user } } = await sb.auth.getUser();

  // 현재 구독 확인
  let currentPlan: string | null = null;
  if (user) {
    const { data: sub } = await sb
      .from('subscriptions')
      .select('plans(slug)')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due'])
      .limit(1)
      .maybeSingle();
    currentPlan = (sub?.plans as any)?.slug ?? null;
  }

  const PLAN_COLORS: Record<string, string> = {
    free: '#64748b',
    premium: '#8b5cf6',
    pro: '#f97316',
  };

  const PLAN_ICONS: Record<string, string> = {
    free: '🆓',
    premium: '💎',
    pro: '🚀',
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {(plans ?? []).map((plan: any) => {
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
              ) : !user ? (
                <Link href="/login" style={{
                  display: 'block', textAlign: 'center', padding: '10px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, color: '#fff', background: color,
                  textDecoration: 'none',
                }}>
                  로그인 후 구독
                </Link>
              ) : (
                <button disabled style={{
                  width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                  fontSize: 13, fontWeight: 700, color: '#fff', background: color,
                  cursor: 'not-allowed', opacity: 0.6,
                }}>
                  준비 중
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
          구독은 언제든 해지할 수 있으며, 해지 후 남은 기간까지 이용 가능합니다.
        </div>
      </div>
    </div>
  );
}
