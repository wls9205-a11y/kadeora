import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

const ALLOWED_ENDPOINTS = [
  '/api/cron/seed-posts', '/api/cron/seed-comments', '/api/cron/seed-chat', '/api/stock-refresh',
  '/api/cron/blog-daily', '/api/cron/blog-apt-new', '/api/cron/blog-weekly', '/api/cron/blog-monthly',
  '/api/admin/seed-finance-blogs',
  '/api/cron/blog-apt-landmark', '/api/cron/blog-redevelopment', '/api/cron/blog-seed-guide', '/api/cron/blog-monthly-theme',
  '/api/cron/crawl-seoul-redev', '/api/cron/crawl-gyeonggi-redev', '/api/cron/crawl-busan-redev', '/api/cron/crawl-unsold-molit',
  '/api/admin/seed-discussions',
];

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

  const cronSecret = process.env.CRON_SECRET || '';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;

  const targetUrl = `${baseUrl}${endpoint}`;
  try {
    const res = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${cronSecret}` },
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
    return NextResponse.json({ status: res.status, endpoint, url: targetUrl, ...data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Trigger failed', endpoint, url: targetUrl }, { status: 500 });
  }
}
