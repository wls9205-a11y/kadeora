import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// GET: 현재 유저의 상담사 프로필 조회
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data: profile } = await sb.from('consultant_profiles')
      .select('*, premium_listings(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({ profile });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// POST: 상담사 등록/수정
export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { name, phone, kakao_id, company, license_no, bio, regions } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 기존 프로필 확인
    const { data: existing } = await admin.from('consultant_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // 수정
      const { data, error } = await admin.from('consultant_profiles')
        .update({ name, phone, kakao_id, company, license_no, bio, regions: regions || [], updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ profile: data, updated: true });
    } else {
      // 생성
      const { data, error } = await admin.from('consultant_profiles')
        .insert({ user_id: user.id, name, phone, kakao_id, company, license_no, bio, regions: regions || [] })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ profile: data, created: true });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
