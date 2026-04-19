import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/admin/user-list — v_admin_user_list 경유
 *
 * 쿼리:
 *   q           : nickname/email ilike
 *   sort        : signup_at|last_active_at|grade|points|influence_score  (default signup_at desc)
 *   limit       : 50 (default) | max 200
 *   offset      : 0
 *   onboarded   : true|false
 *   is_premium  : true|false
 *   is_seed     : true|false
 *   is_dormant  : true|false (is_dormant_14d)
 *   is_excluded : true|false
 *   provider    : kakao|google|naver|apple
 *   grade       : 1..8
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;
  const sp = req.nextUrl.searchParams;

  const sortKey = sp.get('sort') || 'signup_at';
  const ascending = sp.get('asc') === '1';
  const limit = Math.min(200, Math.max(10, Number(sp.get('limit')) || 50));
  const offset = Math.max(0, Number(sp.get('offset')) || 0);

  let q = admin.from('v_admin_user_list').select('*', { count: 'exact' });

  const search = sp.get('q');
  if (search) q = q.or(`nickname.ilike.%${search}%,email.ilike.%${search}%`);
  for (const [key, col] of [
    ['onboarded', 'onboarded'],
    ['is_premium', 'is_premium'],
    ['is_seed', 'is_seed'],
    ['is_dormant', 'is_dormant_14d'],
    ['is_excluded', 'is_excluded'],
  ] as const) {
    const v = sp.get(key);
    if (v === 'true') q = q.eq(col, true);
    else if (v === 'false') q = q.eq(col, false);
  }
  const provider = sp.get('provider');
  if (provider) q = q.eq('provider', provider);
  const grade = sp.get('grade');
  if (grade) q = q.eq('grade', Number(grade));

  q = q.order(sortKey, { ascending });
  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [], total: count || 0, limit, offset });
}
