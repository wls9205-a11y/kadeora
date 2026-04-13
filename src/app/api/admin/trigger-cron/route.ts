import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 60;

/**
 * 관리자용 크론 수동 트리거 API
 * POST /api/admin/trigger-cron
 * body: { endpoint: "/api/cron/crawl-unsold-molit" }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    // 1. 관리자 인증
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. 엔드포인트 파싱
    const { endpoint } = await req.json();
    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('/api/cron/')) {
      return NextResponse.json({ error: 'Invalid endpoint. Must start with /api/cron/' }, { status: 400 });
    }

    // 3. 크론 엔드포인트 호출
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const cronUrl = `${baseUrl}${endpoint}`;
    const cronSecret = process.env.CRON_SECRET;

    const res = await fetch(cronUrl, {
      method: 'GET',
      headers: cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {},
    });

    const data = await res.json().catch(() => ({ status: res.status }));

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      endpoint,
      ...data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 200 });
  }
}
