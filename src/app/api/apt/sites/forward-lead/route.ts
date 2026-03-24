import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { decrypt, hasEncryptionKey } from '@/lib/encryption';

/**
 * 관심고객 → 상담사 전달 파이프라인
 * 
 * 흐름:
 * 1. feature_flags에서 premium_consultant_forwarding 확인
 * 2. 해당 현장의 지역 매칭 상담사 찾기
 * 3. 전화번호 복호화 (AES-256)
 * 4. consultant_leads에 기록
 * 5. privacy_audit_log에 감사 로그
 * 6. 상담사에게 알림 (카카오 알림톡 / 인앱 알림)
 * 
 * 호출 시점:
 * - 관심고객 등록 시 제3자 동의가 있으면 자동 호출
 * - 어드민에서 수동 전달 시 호출
 */

/** 피처 플래그 확인 */
async function isFeatureEnabled(sb: any, key: string): Promise<boolean> {
  const { data } = await (sb as any).from('feature_flags').select('enabled').eq('key', key).single();
  return data?.enabled === true;
}

/** 감사 로그 기록 */
async function auditLog(sb: any, action: string, detail: Record<string, any>, actorId?: string, ip?: string) {
  await (sb as any).from('privacy_audit_log').insert({
    action,
    actor_id: actorId || null,
    actor_type: actorId ? 'admin' : 'system',
    target_table: detail.table || 'apt_site_interests',
    target_id: detail.id || null,
    detail,
    ip_address: ip || null,
  });
}

/** 자동 전달: 관심고객 등록 시 호출 (서버 내부용) */
export async function autoForwardLead(interestId: number, siteId: string) {
  const sb = getSupabaseAdmin();

  // 1. 피처 플래그 확인
  const enabled = await isFeatureEnabled(sb, 'premium_consultant_forwarding');
  if (!enabled) return { forwarded: false, reason: 'feature_disabled' };

  // 2. 현장 정보 가져오기
  const { data: site } = await (sb as any).from('apt_sites').select('region, sigungu, name').eq('id', siteId).single();
  if (!site) return { forwarded: false, reason: 'site_not_found' };

  // 3. 지역 매칭 상담사 찾기 (regions 배열에 현장 지역이 포함된 활성 상담사)
  const { data: consultants } = await sb.from('consultant_profiles')
    .select('id, name, phone, user_id')
    .eq('is_active', true)
    .eq('is_verified', true)
    .contains('regions', [site.region]);

  if (!consultants || consultants.length === 0) {
    return { forwarded: false, reason: 'no_matching_consultant' };
  }

  // 4. 관심고객 정보 가져오기
  const { data: interest } = await (sb as any).from('apt_site_interests')
    .select('id, guest_name, guest_phone, guest_phone_last4, guest_city, guest_district')
    .eq('id', interestId).single();
  if (!interest) return { forwarded: false, reason: 'interest_not_found' };

  // 5. 이미 전달된 건인지 확인
  const { data: existingLead } = await (sb as any).from('consultant_leads')
    .select('id').eq('interest_id', interestId).maybeSingle();
  if (existingLead) return { forwarded: false, reason: 'already_forwarded' };

  // 6. 전화번호 복호화
  let decryptedPhone = '';
  if (interest.guest_phone && hasEncryptionKey()) {
    try {
      decryptedPhone = decrypt(interest.guest_phone);
    } catch {
      decryptedPhone = ''; // 복호화 실패 시 빈 문자열
    }
  }

  // 7. 가장 적합한 상담사 선택 (현재: 첫 번째. 향후: 라운드로빈/로드밸런싱)
  const consultant = consultants[0];

  // 8. consultant_leads 기록
  await (sb as any).from('consultant_leads').insert({
    interest_id: interestId,
    site_id: siteId,
    consultant_id: consultant.id,
    status: 'forwarded',
    forwarded_at: new Date().toISOString(),
  });

  // 9. 감사 로그 (전화번호 원본은 로그에 기록하지 않음)
  await auditLog(sb, 'forward_to_consultant', {
    table: 'consultant_leads',
    interest_id: interestId,
    site_name: site.name,
    consultant_name: consultant.name,
    guest_name: interest.guest_name,
    guest_phone_last4: interest.guest_phone_last4,
    region: site.region,
  });

  // 10. 상담사에게 인앱 알림
  if (consultant.user_id) {
    try {
      await (sb as any).from('notifications').insert({
        user_id: consultant.user_id,
        type: 'consultant_lead',
        title: `새 관심고객: ${site.name}`,
        message: `${interest.guest_name || '고객'}님이 ${site.name}에 관심을 등록했습니다. (****${interest.guest_phone_last4 || '????'})`,
        data: { site_id: siteId, interest_id: interestId },
      });
    } catch {}
  }

  // 11. (향후) 카카오 알림톡 발송 — 상담사 phone으로
  // await sendKakaoAlimtalk(consultant.phone, {
  //   template: 'consultant_new_lead',
  //   variables: {
  //     consultant_name: consultant.name,
  //     site_name: site.name,
  //     guest_name: interest.guest_name,
  //     guest_phone: decryptedPhone, // 복호화된 원본
  //     guest_region: `${interest.guest_city || ''} ${interest.guest_district || ''}`.trim(),
  //   },
  // });

  return {
    forwarded: true,
    consultant_name: consultant.name,
    site_name: site.name,
  };
}

/** 어드민 수동 전달 API */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();

    // 어드민 인증
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { interest_id, site_id } = await req.json();
    if (!interest_id || !site_id) {
      return NextResponse.json({ error: 'interest_id, site_id 필요' }, { status: 400 });
    }

    // 감사 로그 (어드민이 수동 전달 시)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    await auditLog(sb, 'decrypt_phone', {
      table: 'apt_site_interests',
      id: String(interest_id),
      reason: 'admin_manual_forward',
    }, undefined, ip);

    const result = await autoForwardLead(interest_id, site_id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** 피처 플래그 상태 확인 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const enabled = await isFeatureEnabled(sb, 'premium_consultant_forwarding');
  const { data: stats } = await (sb as any).from('consultant_leads')
    .select('status', { count: 'exact' });

  const { data: consultants } = await sb.from('consultant_profiles')
    .select('id', { count: 'exact' })
    .eq('is_active', true);

  return NextResponse.json({
    feature_enabled: enabled,
    active_consultants: consultants?.length || 0,
    total_leads: stats?.length || 0,
  });
}
