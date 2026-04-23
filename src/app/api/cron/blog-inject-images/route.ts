/**
 * 세션 146 B4 / 세션 152 수정 — 블로그 본문에 인라인 이미지 자동 삽입.
 *
 * 세션 152 변경:
 * - 대상 필터: `content NOT ILIKE %![%` → 이미지 개수 < 4 (네이버 캐러셀 진입 조건)
 * - fetch 1,000편씩 pagination → 클라이언트 필터 → BATCH 개 update
 * - injectInlineImages 가 기존 이미지 수 고려, 부족분만 추가 (최소 4장, 최대 6장)
 *
 * 아키텍처 룰 #5: 에러여도 200 반환.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { injectInlineImages } from '@/lib/blog/inject-inline-images';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH = 50;
const PREEMPT_MS = 250_000;
const SCAN_MAX = 4000;

function imgCount(md: string): number {
  if (!md) return 0;
  const mdImgs = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const htmlImgs = (md.match(/<img\s[^>]*>/gi) || []).length;
  return mdImgs + htmlImgs;
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });
  const start = Date.now();
  const sb = getSupabaseAdmin();

  try {
    // view_count DESC 로 pagination 하며 이미지 <4 인 것만 수집
    const targets: any[] = [];
    for (let offset = 0; offset < SCAN_MAX && targets.length < BATCH; offset += 500) {
      if (Date.now() - start > 30_000) break; // 스캔 시간 상한 30s
      const { data: page } = await (sb as any)
        .from('blog_posts')
        .select('id, title, category, tags, content, metadata')
        .eq('is_published', true)
        .gte('content_length', 800)
        .order('view_count', { ascending: false })
        .range(offset, offset + 499);
      if (!page || page.length === 0) break;
      for (const p of page) {
        if (imgCount(p.content || '') < 4) targets.push(p);
        if (targets.length >= BATCH) break;
      }
      if (page.length < 500) break;
    }

    if (targets.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'all posts have 4+ images' });
    }

    let updated = 0;
    let skipped = 0;
    let totalInserts = 0;
    const failures: string[] = [];

    for (const p of targets) {
      if (Date.now() - start > PREEMPT_MS) break;
      const region = p.tags?.find((t: string) => /시$|도$|군$|구$/.test(t)) || null;
      const result = injectInlineImages({
        title: p.title || '',
        category: p.category || 'blog',
        tags: p.tags,
        region,
        markdown: p.content || '',
      });
      if (!result.updated) { skipped++; continue; }
      const { error } = await (sb as any)
        .from('blog_posts')
        .update({ content: result.markdown })
        .eq('id', p.id);
      if (!error) {
        updated++;
        totalInserts += result.inserted;
      } else {
        skipped++;
        failures.push(String(error?.message || '').slice(0, 100));
      }
    }

    return NextResponse.json({
      ok: true,
      scanned_pages: Math.ceil(targets.length / 500),
      candidates: targets.length,
      updated,
      skipped,
      inserted_images: totalInserts,
      sample_failures: failures.slice(0, 3),
      elapsed_ms: Date.now() - start,
    });
  } catch (err: any) {
    return new NextResponse('ok', { status: 200 });
  }
}

export const GET = handler;
export const POST = handler;
