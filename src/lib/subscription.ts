import 'server-only';
import { createSupabaseServer } from './supabase-server';

export type PlanSlug = 'free' | 'premium' | 'pro';

export interface UserSubscription {
  planSlug: PlanSlug;
  planName: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'none';
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** 현재 로그인 유저의 구독 상태 조회 */
export async function getUserSubscription(): Promise<UserSubscription> {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const FREE: UserSubscription = {
    planSlug: 'free', planName: '무료', status: 'none',
    periodEnd: null, cancelAtPeriodEnd: false,
  };

  if (!user) return FREE;

  const { data: sub } = await sb
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end, plans(slug, name)')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub || !sub.plans) return FREE;

  const plan = sub.plans as any;
  return {
    planSlug: plan.slug as PlanSlug,
    planName: plan.name,
    status: sub.status as UserSubscription['status'],
    periodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/** 유저가 프리미엄 이상인지 확인 */
export async function isPremium(): Promise<boolean> {
  const sub = await getUserSubscription();
  return sub.planSlug !== 'free' && sub.status === 'active';
}
