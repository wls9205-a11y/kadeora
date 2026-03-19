import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

const ALLOWED_ENDPOINTS = ['/api/cron/seed-posts', '/api/cron/seed-comments', '/api/cron/seed-chat', '/api/stock-refresh'];

export async function POST(req: NextRequest) {
  // Admin auth check
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { endpoint } = await req.json();
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT || '';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${cronSecret}` },
    });
    const data = await res.json();
    return NextResponse.json({ status: res.status, ...data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Trigger failed' }, { status: 500 });
  }
}
