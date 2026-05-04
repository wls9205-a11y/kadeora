import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

type FilterJson = {
  regions?: string[];
  marketing_required?: boolean;
  channel_required?: boolean;
  active_days?: number;
  message_type?: 'ad' | 'info';
  age_groups?: string[];
  genders?: string[];
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json().catch(() => ({}));
    const filter: FilterJson = body?.filter_json ?? {};

    const sb: any = getSupabaseAdmin();

    const applyFilters = (q: any) => {
      if (Array.isArray(filter.regions) && filter.regions.length) {
        q = q.in('region', filter.regions);
      }
      if (filter.marketing_required === true) {
        q = q.eq('marketing_consent', true);
      }
      if (filter.channel_required === true) {
        q = q.eq('channel_added', true);
      }
      if (typeof filter.active_days === 'number' && filter.active_days > 0) {
        const since = new Date(Date.now() - filter.active_days * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte('last_active_at', since);
      }
      if (filter.message_type === 'ad') {
        q = q.eq('status', '✅ 발송가능');
      }
      if (Array.isArray(filter.age_groups) && filter.age_groups.length) {
        q = q.in('age_group', filter.age_groups);
      }
      if (Array.isArray(filter.genders) && filter.genders.length) {
        q = q.in('gender', filter.genders);
      }
      return q;
    };

    const countQ = applyFilters(sb.from('v_admin_kakao_funnel').select('*', { count: 'exact', head: true }));
    const { count, error: countErr } = await countQ;
    if (countErr) throw countErr;

    const sampleQ = applyFilters(sb.from('v_admin_kakao_funnel').select('*')).limit(10);
    const { data: sample, error: sampleErr } = await sampleQ;
    if (sampleErr) throw sampleErr;

    return NextResponse.json({ count: count ?? 0, sample: sample ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
