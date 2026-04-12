import crypto from 'crypto';

/**
 * kakao-alimtalk.ts — Solapi 카카오 알림톡 발송
 *
 * 비용: 건당 8.4원 (VAT 별도)
 * 일일 상한: 1건/유저
 * SMS fallback: OFF (개인번호 노출 방지)
 *
 * 사전 요구:
 * 1. SOLAPI_API_KEY, SOLAPI_API_SECRET 환경변수
 * 2. 카카오 비즈 채널 개설 + KAKAO_CHANNEL_ID
 * 3. 알림톡 템플릿 심사 완료
 */

interface AlimtalkPayload {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
  disableSms?: boolean; // 기본 true (SMS fallback 차단)
}

function generateSignature(apiKey: string, apiSecret: string, date: string, salt: string): string {
  return crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
}

export async function sendKakaoAlimtalk(payload: AlimtalkPayload): Promise<{ ok: boolean; groupId?: string; error?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.KAKAO_CHANNEL_ID;

  if (!apiKey || !apiSecret) return { ok: false, error: 'SOLAPI keys missing' };
  if (!pfId) return { ok: false, error: 'KAKAO_CHANNEL_ID missing' };

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = generateSignature(apiKey, apiSecret, date, salt);

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({
        messages: [{
          to: payload.phone,
          from: process.env.SOLAPI_SENDER_PHONE || '',
          kakaoOptions: {
            pfId,
            templateId: payload.templateId,
            variables: payload.variables,
            disableSms: payload.disableSms !== false, // 기본 true — SMS fallback 차단
          },
        }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[kakao-alimtalk] API error:', data);
      return { ok: false, error: data?.errorMessage || `HTTP ${res.status}` };
    }

    return { ok: true, groupId: data?.groupId };
  } catch (e) {
    console.error('[kakao-alimtalk]', e);
    return { ok: false, error: String(e) };
  }
}

/**
 * 유저 ID로 알림톡 발송 (profiles.phone 조회)
 */
export async function sendAlimtalkToUser(
  userId: string,
  templateId: string,
  variables: Record<string, string>
): Promise<{ ok: boolean }> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb = getSupabaseAdmin();

    // profiles에서 phone 조회
    const { data: profile } = await sb.from('profiles')
      .select('phone, marketing_agreed')
      .eq('id', userId)
      .single();

    if (!profile?.phone || !profile?.marketing_agreed) {
      return { ok: false }; // 전화번호 없거나 마케팅 미동의
    }

    // 옵트아웃 체크
    const { data: settings } = await (sb as any).from('notification_settings')
      .select('kakao_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (settings?.kakao_enabled === false) {
      return { ok: false }; // 카카오 수신 거부
    }

    const result = await sendKakaoAlimtalk({
      phone: profile.phone.replace(/[^0-9]/g, ''),
      templateId,
      variables,
    });

    return { ok: result.ok };
  } catch {
    return { ok: false };
  }
}
