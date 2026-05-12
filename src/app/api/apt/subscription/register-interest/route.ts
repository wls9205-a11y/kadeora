// app/api/apt/subscription/register-interest/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

interface Body {
  slug: string;
  consent_marketing: boolean;
  consent_third_party?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.slug) {
      return NextResponse.json({ error: 'SLUG_REQUIRED' }, { status: 400 });
    }
    if (typeof body.consent_marketing !== 'boolean') {
      return NextResponse.json({ error: 'CONSENT_REQUIRED' }, { status: 400 });
    }

    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'AUTH_REQUIRED', redirect_url: '/login?source=apt_register_interest' }, { status: 401 });
    }

    const { data, error } = await sb.rpc('register_apt_interest' as any, {
      p_slug: body.slug,
      p_consent_marketing: body.consent_marketing,
      p_consent_third_party: body.consent_third_party ?? false,
    });

    if (error) {
      const message = error.message || 'UNKNOWN_ERROR';
      let status = 400;
      if (message.includes('AUTH_REQUIRED')) status = 401;
      else if (message.includes('DAILY_LIMIT_EXCEEDED')) status = 429;
      else if (message.includes('SITE_NOT_FOUND')) status = 404;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error('[register-interest]', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
