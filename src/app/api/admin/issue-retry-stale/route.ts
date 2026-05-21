// s273-cc 최우선 (apt HOURLY_LIMIT stale backlog re-INSERT)
// Vercel cron 100/100 한도 (Rule #86) — 별도 cron slot 안 사용. 수동/외부 trigger 만.
// Auth: Bearer ${CRON_SECRET} 헤더 (pg_cron + pg_net.http_post 호출 또는 admin curl).
//
// 처리:
// 1. issue_alerts 에서 blog_post_id IS NULL AND block_reason LIKE '%HOURLY_LIMIT%' 인 stale row picking
// 2. draft_title/content/slug/keywords 로 safeBlogInsert 재시도 (limit 200 보장 후 통과)
// 3. 성공 시 issue_alerts.blog_post_id + publish_decision 업데이트
// Architecture Rule #77 (quality gate 차단 alert 재시도 큐).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_BATCH = 50;
const MAX_BATCH = 200;

type Result = {
  picked: number;
  inserted: number;
  skipped: number;
  failed: number;
  remaining_estimate: number;
  samples: { id: string; title: string; outcome: string }[];
};

async function authorize(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${cronSecret}`;
}

function mapCategory(c: string | null | undefined): 'apt' | 'stock' | 'finance' | 'general' {
  if (c === 'apt' || c === 'stock' || c === 'finance' || c === 'general') return c;
  if (c === 'tax' || c === 'economy') return 'finance';
  return 'general';
}

async function processBatch(req: NextRequest, batchSize: number): Promise<Result> {
  const sb = getSupabaseAdmin();
  const result: Result = {
    picked: 0, inserted: 0, skipped: 0, failed: 0, remaining_estimate: 0, samples: [],
  };

  // 1. picking — apt 우선 (s273-cc 최우선), category 미지정 시 전체
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category') ?? 'apt';

  const { data: candidates, error: fetchErr } = await (sb as any)
    .from('issue_alerts')
    .select('id, category, draft_title, draft_content, draft_slug, draft_keywords, source_urls, summary, final_score, publish_decision')
    .is('blog_post_id', null)
    .ilike('block_reason', '%HOURLY_LIMIT%')
    .not('draft_title', 'is', null)
    .not('draft_content', 'is', null)
    .not('draft_slug', 'is', null)
    .eq('category', category)
    .order('final_score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    throw new Error(`fetch: ${fetchErr.message}`);
  }

  result.picked = candidates?.length ?? 0;
  if (result.picked === 0) return result;

  // 2. safeBlogInsert each
  for (const issue of (candidates ?? []) as any[]) {
    try {
      const blogCategory = mapCategory(issue.category);
      const titleHash = String(issue.draft_title).split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      const designs = [1, 2, 3, 4, 5, 6];
      const design = designs[titleHash % designs.length];
      const coverImage = `${SITE_URL}/api/og?title=${encodeURIComponent(issue.draft_title)}&category=${blogCategory}&author=${encodeURIComponent('카더라')}&design=${design}`;

      const metaDesc = ((issue.summary || issue.draft_title || '') as string).slice(0, 160);
      const tags = Array.isArray(issue.draft_keywords) ? issue.draft_keywords : [];

      const insertResult = await safeBlogInsert(sb as any, {
        slug: issue.draft_slug,
        title: issue.draft_title,
        content: issue.draft_content,
        category: blogCategory as any,
        tags,
        source_type: 'auto_issue',
        cron_type: 'issue-retry-stale',
        source_ref: (issue.source_urls || [])[0],
        meta_description: metaDesc.length >= 20 ? metaDesc : `${metaDesc} — ${issue.draft_title}`.slice(0, 160),
        meta_keywords: tags.join(','),
        cover_image: coverImage,
        image_alt: `${issue.draft_title} — 카더라 분석`,
        is_published: false,
        priority_score: Math.min(100, Math.max(0, Number(issue.final_score) || 0)),
      } as any);

      let blogPostId: number | null = insertResult.id ? Number(insertResult.id) : null;
      if (!blogPostId && issue.draft_slug) {
        const { data: found } = await sb
          .from('blog_posts')
          .select('id')
          .eq('slug', issue.draft_slug)
          .maybeSingle();
        if (found) blogPostId = (found as any).id;
      }

      if (blogPostId) {
        const canAuto = (issue.final_score ?? 0) >= 40;
        await (sb as any)
          .from('issue_alerts')
          .update({
            blog_post_id: blogPostId,
            publish_decision: canAuto ? 'draft' : 'draft',
            block_reason: null,
          })
          .eq('id', issue.id);
        result.inserted++;
        if (result.samples.length < 5) {
          result.samples.push({ id: issue.id, title: String(issue.draft_title).slice(0, 40), outcome: 'inserted' });
        }
      } else {
        // failed — keep block_reason as-is so next attempt can decide
        result.skipped++;
        if (result.samples.length < 5) {
          result.samples.push({
            id: issue.id,
            title: String(issue.draft_title).slice(0, 40),
            outcome: `skip:${insertResult.reason ?? 'unknown'}`,
          });
        }
      }
    } catch (e: any) {
      result.failed++;
      console.warn(`[issue-retry-stale] exception id=${issue.id}:`, e?.message ?? e);
    }
  }

  // 3. remaining estimate
  const { count } = await (sb as any)
    .from('issue_alerts')
    .select('id', { count: 'exact', head: true })
    .is('blog_post_id', null)
    .ilike('block_reason', '%HOURLY_LIMIT%')
    .not('draft_title', 'is', null)
    .not('draft_content', 'is', null)
    .eq('category', category);
  result.remaining_estimate = count ?? 0;

  return result;
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const rawBatch = Number(sp.get('batch') ?? DEFAULT_BATCH);
  const batchSize = Math.min(MAX_BATCH, Math.max(1, Number.isFinite(rawBatch) ? rawBatch : DEFAULT_BATCH));

  try {
    const result = await processBatch(req, batchSize);
    console.info(`[issue-retry-stale] picked=${result.picked} inserted=${result.inserted} skipped=${result.skipped} failed=${result.failed} remaining=${result.remaining_estimate}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[issue-retry-stale]', e?.message ?? e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}

// GET 은 진단용 — 처리 안 함, 현재 backlog 사이즈만
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  const category = req.nextUrl.searchParams.get('category') ?? 'apt';
  const { count } = await (sb as any)
    .from('issue_alerts')
    .select('id', { count: 'exact', head: true })
    .is('blog_post_id', null)
    .ilike('block_reason', '%HOURLY_LIMIT%')
    .not('draft_title', 'is', null)
    .not('draft_content', 'is', null)
    .eq('category', category);
  return NextResponse.json({ ok: true, category, backlog: count ?? 0 });
}
