import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 300;

/**
 * 관리자용 크론 수동 트리거 API
 * POST /api/admin/trigger-cron
 * body: { endpoint: "/api/cron/crawl-unsold-molit" }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
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
