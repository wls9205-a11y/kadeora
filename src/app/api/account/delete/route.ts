import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient as admin } from '@supabase/supabase-js'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function DELETE(req: NextRequest) {
  if (!(await rateLimit(req, 'auth'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    if (body.confirmation !== '계정을 삭제합니다') return NextResponse.json({ error: '확인 문구가 일치하지 않습니다.' }, { status: 400 });
    const { error: pErr } = await supabase.from('profiles').update({ nickname: '탈퇴한 사용자', avatar_url: null, bio: null, is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', user.id);
    if (pErr) { console.error('[Account DEL]', pErr); return NextResponse.json({ error: '계정 삭제 처리 중 오류' }, { status: 500 }); }
    const sb = admin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    // 알림 및 푸시 구독 정리
    await sb.from('notifications').delete().eq('user_id', user.id);
    await sb.from('push_subscriptions').delete().eq('user_id', user.id);
    const { error: aErr } = await sb.auth.admin.deleteUser(user.id);
    if (aErr) console.error('[Account DEL] Auth:', aErr);
    return NextResponse.json({ success: true, message: '계정이 삭제되었습니다.' });
  } catch (err) { console.error('[Account DEL]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
