import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const cronSecret = process.env.CRON_SECRET || '';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const headers = { Authorization: `Bearer ${cronSecret}` };

  const tasks = [
    { name: '시드 게시글', endpoint: '/api/cron/seed-posts' },
    { name: '시드 댓글', endpoint: '/api/cron/seed-comments' },
    { name: '시드 채팅', endpoint: '/api/cron/seed-chat' },
    { name: '주식 시세', endpoint: '/api/stock-refresh' },
  ];

  const results: { name: string; status: number; ok: boolean }[] = [];

  for (const task of tasks) {
    try {
      const res = await fetch(`${baseUrl}${task.endpoint}`, { headers, signal: AbortSignal.timeout(15000) });
      results.push({ name: task.name, status: res.status, ok: res.ok });
    } catch {
      results.push({ name: task.name, status: 0, ok: false });
    }
  }

  return NextResponse.json({
    success: results.every(r => r.ok),
    results,
    timestamp: new Date().toISOString(),
  });
}
