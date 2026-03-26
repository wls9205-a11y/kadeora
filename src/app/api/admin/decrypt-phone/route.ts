import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { decrypt, hasEncryptionKey } from '@/lib/encryption';

/**
 * 어드민 전용 — 전화번호 복호화 API
 * 
 * 호출할 때마다 privacy_audit_log에 감사 로그가 남습니다.
 * - 누가 (admin user_id)
 * - 언제 (timestamp)
 * - 어떤 고객 (interest_id)
 * - IP 주소
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 어드민 인증
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });

    // 2. 요청 파싱
    const { interest_id } = await req.json();
    if (!interest_id) return NextResponse.json({ error: 'interest_id 필요' }, { status: 400 });

    // 3. ENCRYPTION_KEY 확인
    if (!hasEncryptionKey()) {
      return NextResponse.json({ error: 'ENCRYPTION_KEY 환경변수 미설정' }, { status: 500 });
    }

    // 4. 암호화된 전화번호 가져오기
    const admin = getSupabaseAdmin();
    const { data: interest } = await admin.from('apt_site_interests')
      .select('id, guest_phone, guest_name, site_id')
      .eq('id', interest_id).single();

    if (!interest || !interest.guest_phone) {
      return NextResponse.json({ error: '해당 관심단지 없음' }, { status: 404 });
    }

    // 5. 복호화
    let phone = '';
    try {
      phone = decrypt(interest.guest_phone);
    } catch {
      return NextResponse.json({ error: '복호화 실패 — 키가 다르거나 데이터 손상' }, { status: 500 });
    }

    // 6. 감사 로그 기록 (필수 — 이 로그 없이는 복호화 불가)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    await admin.from('privacy_audit_log').insert({
      action: 'decrypt_phone',
      actor_id: user.id,
      actor_type: 'admin',
      target_table: 'apt_site_interests',
      target_id: String(interest_id),
      detail: {
        guest_name: interest.guest_name,
        site_id: interest.site_id,
        reason: 'admin_manual_view',
      },
      ip_address: ip,
    });

    // 7. 포맷팅해서 반환
    const formatted = phone.length === 11
      ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`
      : phone;

    return NextResponse.json({ phone: formatted });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
