import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();

  try {
    const { email, category, consent } = await req.json();

    if (!email || !consent) {
      return NextResponse.json({ error: '이메일과 동의가 필요합니다' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { error } = await (sb as any).from('email_subscribers').upsert(
      { email: email.toLowerCase().trim(), category: category || 'general', consent: true, subscribed_at: new Date().toISOString() },
      { onConflict: 'email' }
    );

    if (error) {
      console.error('Newsletter subscribe error:', error);
      return NextResponse.json({ error: '구독 처리 중 오류' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서비스 오류' }, { status: 500 });
  }
}
