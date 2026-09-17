import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  // B1 (2026-09-17) 존치(콜드): user_events 12만 행 위 집계 뷰라 estimated 는 의미가 없다(플래너 추정 ≠ 고래 수).
  //   관리자 전용·현재 앱 호출자 0. 핫패스로 옮기면 크론 캐시로 바꿀 것.
  const { count, error } = await admin
    .from('v_admin_whale_unconverted')
    .select('*', { count: 'exact', head: true });

  if (error) return NextResponse.json({ count: 0, error: error.message }, { status: 200 });
  return NextResponse.json({ count: count || 0 });
}
