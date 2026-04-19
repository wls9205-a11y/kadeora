/**
 * [INDEXNOW-AUTO] 세션 139 — 수동 IndexNow 백필
 *
 * 용도: 글 내용/제목이 변경된 후 (ex: 삼익비치 Pillar title 교체, 5 Spoke 확장)
 *      indexed_at은 최신이지만 실제 IndexNow 제출이 한 번 더 필요한 경우.
 *
 * POST body:
 *   { slugs: string[] }  OR  { pattern: string }  (slug ILIKE '%pattern%')
 *   { dry_run?: boolean } (true면 제출 없이 대상 slug만 반환)
 *
 * 제한: 50 slug/request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { submitIndexNow } from '@/lib/indexnow';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const dryRun = Boolean(body?.dry_run);
  const MAX = 50;

  let targets: { slug: string }[] = [];
  if (Array.isArray(body?.slugs) && body.slugs.length > 0) {
    const slugs: string[] = body.slugs.filter((s: any) => typeof s === 'string').slice(0, MAX);
    const { data } = await auth.admin
      .from('blog_posts')
      .select('slug')
      .in('slug', slugs as any)
      .eq('is_published', true);
    targets = (data || []) as { slug: string }[];
  } else if (typeof body?.pattern === 'string' && body.pattern.length > 0) {
    const { data } = await auth.admin
      .from('blog_posts')
      .select('slug')
      .ilike('slug', `%${body.pattern}%`)
      .eq('is_published', true)
      .limit(MAX);
    targets = (data || []) as { slug: string }[];
  } else {
    return NextResponse.json({ error: 'slugs (string[]) 또는 pattern (string) 중 하나 필수' }, { status: 400 });
  }

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: 'no matching published slugs' });
  }

  const urls = targets.map((t) => `/blog/${t.slug}`);
  if (dryRun) {
    return NextResponse.json({ ok: true, dry_run: true, count: urls.length, urls });
  }

  let indexedAtUpdated = 0;
  try {
    await submitIndexNow(urls);
    const { error } = await auth.admin
      .from('blog_posts')
      .update({ indexed_at: new Date().toISOString() })
      .in('slug', targets.map((t) => t.slug) as any);
    if (!error) indexedAtUpdated = targets.length;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'submitIndexNow failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, count: urls.length, indexed_at_updated: indexedAtUpdated });
}
