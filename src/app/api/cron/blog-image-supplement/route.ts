import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyPgCronAuth } from '@/lib/cron-pg-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const TARGET_COUNT = 7;
const MIN_COUNT = 3;
const BATCH_LIMIT = 40;
const MAX_RUNTIME_MS = 250_000;

const DOMAIN_BLACKLIST = [
  /hogangnono/i, /kbstar\.com/i, /zigbang|dabang/i, /dcinside\./i,
  /i\.pinimg\.com|ruliweb\.com/i, /namu\.wiki/i, /\.gif(\?|$)/i,
];

function isBlacklisted(url: string): boolean {
  if (!url) return true;
  return DOMAIN_BLACKLIST.some((re) => re.test(url));
}

async function searchNaverImages(query: string, display = 10): Promise<{ url: string; thumb: string; title: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim&filter=large`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.items || [];
    return items
      .filter((i) => {
        const w = parseInt(i.sizewidth || '0');
        const h = parseInt(i.sizeheight || '0');
        if (w < 400 || h < 250) return false;
        if (isBlacklisted(i.link || '')) return false;
        return true;
      })
      .map((i) => ({
        url: (i.link || '').replace(/^http:\/\//, 'https://'),
        thumb: (i.thumbnail || i.link || '').replace(/^http:\/\//, 'https://'),
        title: (i.title || '').replace(/<[^>]+>/g, ''),
      }));
  } catch {
    return [];
  }
}

function buildQueries(title: string, tags: string[] | null, category: string | null): string[] {
  const base = (title || '').split(/[—|·\[\]()]/)[0].trim().slice(0, 40);
  const usefulTags = (tags || []).filter((t) => t && t.length >= 2 && t.length <= 20).slice(0, 3);
  const queries: string[] = [];
  if (base) queries.push(base);
  for (const tag of usefulTags) {
    if (base && !base.includes(tag)) queries.push(`${base} ${tag}`);
    else queries.push(tag);
  }
  if (category === 'apt' && base) queries.push(`${base} 아파트`);
  if (category === 'stock' && base) queries.push(`${base} 종목`);
  return [...new Set(queries)].slice(0, 4);
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('blog-image-supplement', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        return { processed: 0, metadata: { error: 'NAVER API keys not set' } };
      }

      // 세션 136 fix: 실제 RPC 시그니처는 get_blogs_needing_images(p_limit)
      // 반환: TABLE(post_id, title, slug, category, tags, current_image_count)
      const { data: lowImgPosts, error: rpcErr } = await (sb as any).rpc(
        'get_blogs_needing_images',
        { p_limit: BATCH_LIMIT },
      );

      let targets = (lowImgPosts as any[] | null)?.map((r) => ({
        id: r.post_id,
        slug: r.slug,
        title: r.title,
        category: r.category,
        tags: r.tags,
        current_image_count: r.current_image_count,
      })) ?? null;

      if (rpcErr || !Array.isArray(targets)) {
        // RPC 실패 시 PostgREST fallback
        const { data: fallback } = await sb
          .from('blog_posts')
          .select('id, slug, title, category, tags')
          .eq('is_published', true)
          .order('view_count', { ascending: false, nullsFirst: false })
          .limit(BATCH_LIMIT);
        targets = (fallback || []).map((r: any) => ({ ...r, current_image_count: undefined }));
      }

      if (!targets || targets.length === 0) {
        return { processed: 0, metadata: { message: '보충 대상 없음', elapsed_ms: Date.now() - start } };
      }

      let processed = 0;
      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const post of targets) {
        if (Date.now() - start > MAX_RUNTIME_MS) {
          errors.push('timeout guard');
          break;
        }
        try {
          // 현재 이미지 수 확인
          const { count } = await (sb as any)
            .from('blog_post_images')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', post.id);
          const haveCount = count || 0;
          if (haveCount >= MIN_COUNT) continue;

          const need = TARGET_COUNT - haveCount;
          const queries = buildQueries(post.title, post.tags, post.category);
          const collected: { url: string; thumb: string; title: string }[] = [];
          const seenUrls = new Set<string>();

          for (const q of queries) {
            if (collected.length >= need) break;
            const imgs = await searchNaverImages(q, need + 2);
            for (const img of imgs) {
              if (seenUrls.has(img.url)) continue;
              seenUrls.add(img.url);
              collected.push(img);
              if (collected.length >= need) break;
            }
          }

          processed++;
          if (collected.length === 0) {
            failed++;
            continue;
          }

          const rows = collected.map((img, idx) => ({
            post_id: post.id,
            image_url: img.url,
            alt_text: `${post.title} 관련 이미지 ${haveCount + idx + 1}`,
            caption: img.title || null,
            image_type: 'supplement',
            position: haveCount + idx,
          }));

          // UNIQUE (post_id, image_url) 제약 고려 — onConflict ignore
          const { error: insertErr } = await (sb as any)
            .from('blog_post_images')
            .upsert(rows, { onConflict: 'post_id,image_url', ignoreDuplicates: true });
          if (insertErr) {
            failed++;
            errors.push(`post ${post.id}: ${insertErr.message}`);
          } else {
            created += rows.length;
          }
          await new Promise((r) => setTimeout(r, 120));
        } catch (e) {
          failed++;
          errors.push(`post ${post.id}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }

      return {
        processed,
        created,
        failed,
        metadata: {
          target: TARGET_COUNT,
          min: MIN_COUNT,
          batch: BATCH_LIMIT,
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 10),
        },
      };
    }),
  );
}

export async function GET(req: NextRequest) {
  if (!verifyPgCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await handler(req);
  } catch (e) {
    console.error('[blog-image-supplement] error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
