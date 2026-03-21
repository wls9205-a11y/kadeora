import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const admin = getSupabaseAdmin();
  const cronSecret = process.env.CRON_SECRET || '';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const headers = { Authorization: `Bearer ${cronSecret}` };

  // 1. 전체 삭제
  await admin.from('blog_comments').delete().neq('id', 0);
  await admin.from('blog_posts').delete().neq('id', 0);

  // 2. 크론 순차 호출
  const crons = ['/api/cron/blog-apt-new', '/api/cron/blog-daily', '/api/cron/blog-weekly', '/api/cron/blog-monthly'];
  const results: { name: string; created: number }[] = [];
  for (const ep of crons) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, { headers, signal: AbortSignal.timeout(30000) });
      const data = await res.json();
      results.push({ name: ep.split('/').pop() ?? '', created: data.created ?? 0 });
    } catch {
      results.push({ name: ep.split('/').pop() ?? '', created: -1 });
    }
  }

  const totalCreated = results.reduce((s, r) => s + Math.max(r.created, 0), 0);
  return NextResponse.json({ ok: true, totalCreated, results });
}
