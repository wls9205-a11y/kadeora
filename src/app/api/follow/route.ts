import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: 팔로우 여부 + 카운트
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('targetId');
  if (!targetId) return NextResponse.json({ following: false, followers: 0, following_count: 0 });

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = getSupabaseAdmin();

    const [{ count: followers }, { count: following_count }, followCheck] = await Promise.all([
      admin.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', targetId),
      admin.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
      user ? admin.from('follows').select('follower_id').eq('follower_id', user.id).eq('followee_id', targetId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      following: !!(followCheck as { data: unknown }).data,
      followers: followers ?? 0,
      following_count: following_count ?? 0,
    });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST: 팔로우 토글
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { targetId } = await request.json();
    if (!targetId || targetId === user.id) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from('follows').select('follower_id')
      .eq('follower_id', user.id).eq('followee_id', targetId).maybeSingle();

    if (existing) {
      await admin.from('follows').delete().eq('follower_id', user.id).eq('followee_id', targetId);
      // followers_count/following_count는 DB 트리거(handle_follow_change)가 자동 관리
      return NextResponse.json({ following: false });
    } else {
      await admin.from('follows').insert({ follower_id: user.id, followee_id: targetId });
      // followers_count/following_count는 DB 트리거(handle_follow_change)가 자동 관리

      // 팔로우 알림 (타인 데이터 — service_role)
      try {
        const { data: profile } = await admin.from('profiles').select('nickname').eq('id', user.id).single();
        await admin.from('notifications').insert({
          user_id: targetId, type: 'follow',
          content: `${profile?.nickname ?? '누군가'}님이 팔로우했어요`,
        });
      } catch {}

      return NextResponse.json({ following: true });
    }
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
