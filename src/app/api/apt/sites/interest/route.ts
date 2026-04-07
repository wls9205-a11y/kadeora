import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { encrypt, hasEncryptionKey } from '@/lib/encryption';
import { autoForwardLead } from '@/lib/forward-lead';
import { z } from 'zod';

const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;
const birthRegex = /^\d{4}-\d{2}-\d{2}$/;

const GuestSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(2, '이름은 2자 이상').max(20),
  phone: z.string().regex(phoneRegex, '올바른 전화번호 형식이 아닙니다 (010-XXXX-XXXX)'),
  birth_date: z.string().regex(birthRegex, '생년월일은 YYYY-MM-DD 형식'),
  city: z.string().min(1, '거주 지역을 선택해주세요'),
  district: z.string().optional(),
  consent_collection: z.literal(true, { errorMap: () => ({ message: '개인정보 수집·이용 동의는 필수입니다' }) }),
  consent_marketing: z.boolean().optional(),
  consent_third_party: z.boolean().optional(),
});

const MemberSchema = z.object({
  site_id: z.string().uuid(),
});

const CONSENT_TEXT_V1 = `[필수] 개인정보 수집·이용 동의 (v1.1)
1. 수집항목: 이름, 전화번호, 생년월일, 거주지역
2. 수집목적: 관심 단지 분양 정보 제공 및 일정 알림
3. 보유기간: 동의 철회 시 또는 수집 목적 달성 후 즉시 파기
4. 동의를 거부할 권리가 있으며, 거부 시 관심단지 등록 서비스를 이용할 수 없습니다.`;

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'auth'))) return rateLimitResponse();

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    // 회원 여부 체크
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await sb.auth.getUser();

    // type 기반 분기 (로그인 유저도 guest 폼 사용 가능)
    if (body.type === 'member') {
      // ━━━ 회원 등록 (원클릭) ━━━
      if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
      const parsed = MemberSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

      const { data: existing } = await admin.from('apt_site_interests')
        .select('id').eq('site_id', parsed.data.site_id).eq('user_id', user.id).maybeSingle();
      if (existing) return NextResponse.json({ error: '이미 관심 등록된 현장입니다' }, { status: 409 });

      // 프로필에서 거주 시도/시군구 가져오기
      const { data: profile } = await admin.from('profiles')
        .select('residence_city, residence_district')
        .eq('id', user.id).single();

      // 첫 미션: 관심 현장 등록 (직접 DB 업데이트)
    try {
      const missionUserId = userId;
      if (missionUserId) {
        const { data: prof } = await admin.from('profiles').select('first_mission_completed, first_mission_progress').eq('id', missionUserId).single();
        if (prof && !prof.first_mission_completed) {
          const prog = (prof as any).first_mission_progress || {};
          if (!prog.interest) {
            prog.interest = true;
            await admin.rpc('award_points', { p_user_id: missionUserId, p_amount: 50, p_reason: '첫 미션: 관심현장' });
            const done = Object.values(prog).filter(Boolean).length;
            if (done >= 2) await admin.rpc('award_points', { p_user_id: missionUserId, p_amount: 200, p_reason: '첫 미션 보너스' });
            await (admin as any).from('profiles').update({ first_mission_progress: prog, first_mission_completed: done >= 2 }).eq('id', missionUserId);
          }
        }
      }
    } catch {}
    const { error: insertErr } = await admin.from('apt_site_interests').insert({
        site_id: parsed.data.site_id,
        user_id: user.id,
        is_member: true,
        guest_city: profile?.residence_city || null,
        guest_district: profile?.residence_district || null,
        source: 'site_page',
      });
      if (insertErr) throw insertErr;

      await admin.rpc('increment_site_interest', { p_site_id: parsed.data.site_id });
      try { await admin.rpc('award_points', { p_user_id: user.id, p_amount: 50, p_reason: '관심단지등록' }); } catch {}

      return NextResponse.json({ success: true, message: '관심 등록 완료! +50P 적립' });

    } else {
      // ━━━ 게스트 폼 등록 (비회원 + 로그인 유저 모두 가능) ━━━
      const parsed = GuestSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

      const birthDate = new Date(parsed.data.birth_date);
      const age = Math.floor((Date.now() - birthDate.getTime()) / 31557600000);
      if (age < 14) return NextResponse.json({ error: '만 14세 미만은 법정대리인의 동의가 필요합니다. (개인정보 보호법 제22조의2)' }, { status: 400 });
      if (age > 120 || age < 0) return NextResponse.json({ error: '올바른 생년월일을 입력해주세요' }, { status: 400 });

      const cleanPhone = parsed.data.phone.replace(/-/g, '');
      const crypto = await import('crypto');
      const phoneHash = crypto.createHash('sha256').update(cleanPhone).digest('hex');
      const encryptedPhone = hasEncryptionKey() ? encrypt(cleanPhone) : cleanPhone;

      const { data: existing } = await admin.from('apt_site_interests')
        .select('id').eq('site_id', parsed.data.site_id).eq('guest_phone_hash', phoneHash).maybeSingle();
      if (existing) return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 });

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ua = req.headers.get('user-agent') || '';

      const { data: c1 } = await admin.from('privacy_consents').insert({
        guest_identifier: cleanPhone.slice(-4),
        consent_type: 'interest_collection',
        consent_version: 'v1.1',
        is_agreed: true,
        consent_text: CONSENT_TEXT_V1,
        ip_address: ip,
        user_agent: ua.slice(0, 200),
        collected_items: ['이름', '전화번호', '생년월일', '거주지역'],
        purpose: '관심 단지 분양 정보 제공 및 일정 알림',
        retention_period: '동의 철회 시 또는 목적 달성 후 즉시 파기',
      }).select('id').single();

      if (parsed.data.consent_marketing) {
        await admin.from('privacy_consents').insert({
          guest_identifier: cleanPhone.slice(-4),
          consent_type: 'marketing',
          consent_version: 'v1.1',
          is_agreed: true,
          ip_address: ip,
          user_agent: ua.slice(0, 200),
          collected_items: ['이름', '전화번호'],
          purpose: '신규 분양 현장 안내, 이벤트 정보 발송',
          retention_period: '동의 철회 시까지',
        });
      }

      const { data: inserted, error: insertErr } = await admin.from('apt_site_interests').insert({
        site_id: parsed.data.site_id,
        guest_name: parsed.data.name,
        guest_phone: encryptedPhone,
        guest_phone_hash: phoneHash,
        guest_phone_last4: cleanPhone.slice(-4),
        guest_birth_date: parsed.data.birth_date,
        guest_city: parsed.data.city || null,
        guest_district: parsed.data.district || null,
        source: 'site_page',
        consent_id: c1?.id || null,
        is_member: false,
        ...(user ? { user_id: user.id } : {}),
      }).select('id').single();
      if (insertErr) throw insertErr;

      await admin.rpc('increment_site_interest', { p_site_id: parsed.data.site_id });

      if (parsed.data.consent_third_party && inserted?.id) {
        try { await autoForwardLead(inserted.id, parsed.data.site_id); } catch {}
      }

      return NextResponse.json({ success: true, message: '관심단지 등록이 완료되었습니다' });
    }
  } catch (e: unknown) {
    console.error('[apt/sites/interest]', e);
    return NextResponse.json({ error: '등록 중 오류가 발생했습니다' }, { status: 500 });
  }
}

// 내 관심단지 조회
export async function GET(req: NextRequest) {
  if (!(await rateLimit(req))) return rateLimitResponse();

  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ interests: [] });

    const admin = getSupabaseAdmin();
    const { data } = await admin.from('apt_site_interests')
      .select('site_id, created_at, apt_sites(slug, name, site_type, region)')
      .eq('user_id', user.id).order('created_at', { ascending: false });

    return NextResponse.json({ interests: data || [] });
  } catch {
    return NextResponse.json({ interests: [] });
  }
}

// 관심 해제
export async function DELETE(req: NextRequest) {
  if (!(await rateLimit(req, 'auth'))) return rateLimitResponse();

  try {
    const { site_id } = await req.json();
    if (!site_id) return NextResponse.json({ error: 'site_id 필요' }, { status: 400 });

    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const admin = getSupabaseAdmin();
    await admin.from('apt_site_interests').delete().eq('site_id', site_id).eq('user_id', user.id);

    // 관심 수 감소 (0 이하로 내려가지 않게)
    try { await admin.rpc('decrement_site_interest', { p_site_id: site_id }); } catch {}

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '처리 중 오류' }, { status: 500 });
  }
}
