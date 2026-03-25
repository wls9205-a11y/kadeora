export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

/**
 * 동의 철회 후 5일 이내 개인정보 파기 크론
 * 
 * 1. withdrawn_at이 5일 이상 지난 privacy_consents 조회
 * 2. 해당 guest_identifier로 apt_site_interests에서 비회원 정보 삭제
 * 3. privacy_consents에서 guest_identifier를 '삭제됨'으로 마스킹
 *    (동의 증빙 이력 자체는 3년 보관 — 개인정보보호법 근거)
 */
async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let purged = 0;
  const errors: string[] = [];

  try {
    // 5일 전 날짜
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // 철회된 동의 중 5일 이상 지난 것 (아직 파기 안 된 것)
    const { data: withdrawnConsents } = await sb.from('privacy_consents')
      .select('id, guest_identifier, consent_type, withdrawn_at')
      .not('withdrawn_at', 'is', null)
      .lte('withdrawn_at', fiveDaysAgo)
      .neq('guest_identifier', '삭제됨')
      .limit(100);

    if (!withdrawnConsents || withdrawnConsents.length === 0) {
      return NextResponse.json({ success: true, purged: 0, message: '파기 대상 없음' });
    }

    for (const consent of withdrawnConsents) {
      try {
        // guest_identifier는 전화번호 뒤 4자리 — 이걸로 매칭
        // 해당 사용자의 모든 관심고객 데이터 삭제
        if (consent.guest_identifier && consent.guest_identifier !== '삭제됨') {
          // 비회원 관심고객 중 해당 전화번호 뒤 4자리로 매칭되는 레코드 삭제
          const { data: interests } = await sb.from('apt_site_interests')
            .select('id, guest_phone')
            .not('guest_phone', 'is', null);

          const toDelete = (interests || []).filter((i: any) => 
            i.guest_phone && i.guest_phone.endsWith(consent.guest_identifier)
          );

          for (const interest of toDelete) {
            await sb.from('apt_site_interests').delete().eq('id', interest.id);
          }

          // 동의 기록에서 개인 식별자 마스킹 (증빙 이력은 유지)
          await sb.from('privacy_consents').update({
            guest_identifier: '삭제됨',
            ip_address: null,
            user_agent: null,
          }).eq('id', consent.id);

          purged++;
        }
      } catch (e: any) {
        errors.push(`consent ${consent.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`main: ${e.message}`);
  }

  return NextResponse.json({
    success: true,
    purged,
    elapsed: `${Date.now() - start}ms`,
    errors: errors.length ? errors : undefined,
  });
}

export const GET = withCronAuth(handler);
