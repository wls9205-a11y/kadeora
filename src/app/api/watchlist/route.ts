/**
 * /api/watchlist — POST/DELETE handlers calling add_to_watchlist / remove_from_watchlist RPC.
 * Server-side cookies 인증 (createSupabaseServer). 401 if not logged in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// s221: apt_sites.id 가 uuid 라 string 으로 받음 (s220 number 가정 버그)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function getAptId(req: NextRequest): Promise<string | null> {
  try {
    const body = await req.json();
    const id = String(body?.apt_id || '');
    return UUID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function requireUser() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return { sb, user };
}

export async function POST(req: NextRequest) {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 });

  const aptId = await getAptId(req);
  if (!aptId) return NextResponse.json({ ok: false, error: 'invalid_apt_id' }, { status: 400 });

  const { data, error } = await (ctx.sb as any).rpc('add_to_watchlist', { p_apt_id: aptId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 });

  const aptId = await getAptId(req);
  if (!aptId) return NextResponse.json({ ok: false, error: 'invalid_apt_id' }, { status: 400 });

  const { data, error } = await (ctx.sb as any).rpc('remove_from_watchlist', { p_apt_id: aptId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
