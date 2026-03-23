import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subscription } = await req.json();
  const admin = getSupabaseAdmin();

  await admin.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh,
    auth: subscription.keys?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const sb = await createSupabaseServer();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  await admin.from('push_subscriptions').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}