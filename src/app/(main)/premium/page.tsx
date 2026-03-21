import { createSupabaseServer } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import PremiumClient from './PremiumClient';

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

  return (
    <PremiumClient
      plans={(plans ?? []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        features: p.features ?? [],
        is_active: p.is_active,
        sort_order: p.sort_order,
      }))}
      currentPlan={currentPlan}
      isLoggedIn={!!user}
    />
  );
}
