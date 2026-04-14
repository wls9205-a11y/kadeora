import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 온보딩 관심 설정 기반 자동 알림 등록
 * - notification_settings: 관심사별 최적 알림 활성화
 * - email_subscribers: 주간 리포트 자동 등록
 */
export async function POST(req: NextRequest) {
  try {
    const { interests, region } = await req.json();
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { try { return cookieStore.getAll(); } catch { return []; } } } }
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const hasApt = interests?.includes('apt') || interests?.includes('redev') || interests?.includes('unsold');
    const hasStock = interests?.includes('stock');

    // notification_settings 자동 생성
    await sb.from('notification_settings').upsert({
      user_id: user.id,
      push_apt_deadline: hasApt,
      push_stock_alert: hasStock,
      push_daily_digest: true,
      push_news: true,
      push_hot_post: true,
      push_comments: true,
      push_likes: true,
      push_follows: true,
      push_attendance: false,
      email_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // email_subscribers 자동 등록 (이메일이 있는 경우)
    if (user.email) {
      await sb.from('email_subscribers').upsert({
        email: user.email,
        user_id: user.id,
        is_active: true,
        interests: interests || ['news'],
        region: region || null,
        subscribed_at: new Date().toISOString(),
      }, { onConflict: 'email' }).then(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
