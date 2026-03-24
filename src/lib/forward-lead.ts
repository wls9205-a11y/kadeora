import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { decrypt, hasEncryptionKey } from '@/lib/encryption';

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

/**
 * 관심고객 → 상담사 자동 전달
 * 
 * feature_flags.premium_consultant_forwarding = false면 no-op
 * true면: 지역 매칭 상담사 찾기 → 복호화 → leads 기록 → 감사 로그 → 알림
 */
export async function autoForwardLead(interestId: number, siteId: string) {
  const sb = getSupabaseAdmin();

  const enabled = await isFeatureEnabled(sb, 'premium_consultant_forwarding');
  if (!enabled) return { forwarded: false, reason: 'feature_disabled' };

  const { data: site } = await (sb as any).from('apt_sites').select('region, sigungu, name').eq('id', siteId).single();
  if (!site) return { forwarded: false, reason: 'site_not_found' };

  const { data: consultants } = await (sb as any).from('consultant_profiles')
    .select('id, name, phone, user_id')
    .eq('is_active', true)
    .eq('is_verified', true)
    .contains('regions', [site.region]);

  if (!consultants || consultants.length === 0) {
    return { forwarded: false, reason: 'no_matching_consultant' };
  }

  const { data: interest } = await (sb as any).from('apt_site_interests')
    .select('id, guest_name, guest_phone, guest_phone_last4, guest_city, guest_district')
    .eq('id', interestId).single();
  if (!interest) return { forwarded: false, reason: 'interest_not_found' };

  const { data: existingLead } = await (sb as any).from('consultant_leads')
    .select('id').eq('interest_id', interestId).maybeSingle();
  if (existingLead) return { forwarded: false, reason: 'already_forwarded' };

  // 전화번호 복호화 (상담사 전달용)
  let decryptedPhone = '';
  if (interest.guest_phone && hasEncryptionKey()) {
    try { decryptedPhone = decrypt(interest.guest_phone); } catch {}
  }

  const consultant = consultants[0];

  await (sb as any).from('consultant_leads').insert({
    interest_id: interestId,
    site_id: siteId,
    consultant_id: consultant.id,
    status: 'forwarded',
    forwarded_at: new Date().toISOString(),
  });

  await auditLog(sb, 'forward_to_consultant', {
    table: 'consultant_leads',
    interest_id: interestId,
    site_name: site.name,
    consultant_name: consultant.name,
    guest_name: interest.guest_name,
    guest_phone_last4: interest.guest_phone_last4,
    region: site.region,
  });

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

  // (향후) 카카오 알림톡으로 decryptedPhone 전달

  return { forwarded: true, consultant_name: consultant.name, site_name: site.name };
}

/** 감사 로그 기록 (외부 호출용) */
export { auditLog };
