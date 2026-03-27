import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const [logsR, subR] = await Promise.all([
    admin.from('push_logs').select('id, title, body, target, sent_count, click_count, created_at').order('created_at', { ascending: false }).limit(30),
    admin.from('push_subscriptions').select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    logs: logsR.data || [],
    subCount: subR.count || 0,
  });
}
