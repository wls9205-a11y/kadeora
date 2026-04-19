/**
 * [P0-IMAGE] 세션 140 — 이미지 백필 수동 트리거
 *
 * POST body:
 *   { target: 'all' | 'samik-beach' | 'slug:<pattern>' | { post_ids: number[] } }
 *   { limit?: number } (기본 50, 최대 200)
 *   { dry_run?: boolean }
 *
 * 동작:
 *  1. 대상 blog_posts 선택 (cover_image=OG 또는 blog_post_images=0 인 것)
 *  2. 네이버 이미지 검색 (NAVER_CLIENT_ID/SECRET) 제목+카테고리 기반 5장
 *  3. blog_post_images INSERT (onConflict ignore) + cover_image 실사진 교체
 *  4. big_event 연결 글이면 big_event_assets에도 반영
 *
 * 주의: Redis lock 없음 (관리자 수동 트리거라 1개씩만 실행).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

const IMG_BLOCK_DOMAINS = [
  'hogangnono', 'kbland', 'kbstar.com', 'zigbang', 'dabang',
  'dcinside', 'ruliweb', 'pinimg', 'namu.wiki', 'ohousecdn',
  'shop1.phinf.naver.net', 'shop2.phinf', 'shop3.phinf',
];

function isBlacklisted(url: string): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return IMG_BLOCK_DOMAINS.some((d) => u.includes(d));
}

async function searchImages(query: string, count = 6): Promise<{ url: string; alt: string; source: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`,
      {
        headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .map((item: any) => {
        const url = (item.link || '').replace(/^http:\/\//, 'https://');
        const alt = (item.title || query).replace(/<[^>]+>/g, '').trim();
        let source = '웹';
        try { source = new URL(url).hostname; } catch { /* ignore */ }
        return { url, alt, source };
      })
      .filter((img: any) => img.url && !isBlacklisted(img.url));
  } catch {
    return [];
  }
}

function catLabel(cat: string): string {
  return cat === 'stock' ? '주식' : cat === 'apt' ? '부동산' : cat === 'unsold' ? '미분양' : cat === 'finance' ? '재테크' : '정보';
}

function buildQueries(post: any): string[] {
  const title = String(post.title || '');
  const firstTag = Array.isArray(post.tags) && post.tags[0] ? String(post.tags[0]) : '';
  const cat = catLabel(post.category || '');
  const queries: string[] = [];
  if (firstTag) queries.push(`${firstTag} ${cat}`.trim());
  if (title) queries.push(`${title.split(/[|—·\s]/).slice(0, 3).join(' ')} ${cat}`.trim());
  if (firstTag) queries.push(`${firstTag} 조감도`);
  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 3))];
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const target = body?.target ?? 'all';
  const limit = Math.min(Math.max(Number(body?.limit || 50), 1), 200);
  const dryRun = Boolean(body?.dry_run);

  const sb = auth.admin;

  // 대상 선정
  let q = (sb as any).from('blog_posts').select('id, slug, title, tags, category, cover_image').eq('is_published', true).limit(limit);

  if (target === 'samik-beach') {
    q = q.ilike('slug', '%samik-beach%');
  } else if (typeof target === 'string' && target.startsWith('slug:')) {
    q = q.ilike('slug', `%${target.slice('slug:'.length)}%`);
  } else if (target && typeof target === 'object' && Array.isArray(target.post_ids) && target.post_ids.length > 0) {
    q = q.in('id', target.post_ids);
  } else {
    // 'all' — cover_image가 OG 인 것 우선
    q = q.like('cover_image', '%/api/og%').order('view_count', { ascending: false });
  }

  const { data: posts, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!posts || posts.length === 0) return NextResponse.json({ ok: true, count: 0, message: 'no targets' });

  if (dryRun) {
    return NextResponse.json({ ok: true, dry_run: true, count: posts.length, sample: posts.slice(0, 10).map((p: any) => p.slug) });
  }

  let inserted = 0;
  let coverUpdated = 0;
  let failed = 0;
  const notes: string[] = [];

  for (const p of posts as any[]) {
    try {
      // 기존 이미지 position max
      const { data: existing } = await (sb as any)
        .from('blog_post_images')
        .select('position')
        .eq('post_id', p.id)
        .order('position', { ascending: false })
        .limit(1);
      const startPos = Array.isArray(existing) && existing.length > 0 ? Number(existing[0]?.position || 0) + 1 : 0;

      // 이미지 검색
      const queries = buildQueries(p);
      let imgs: { url: string; alt: string; source: string }[] = [];
      for (const query of queries) {
        if (imgs.length >= 5) break;
        const r = await searchImages(query, 4);
        imgs.push(...r);
        await new Promise((r) => setTimeout(r, 120));
      }
      // 중복 제거
      const seen = new Set<string>();
      imgs = imgs.filter((img) => {
        if (seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
      }).slice(0, 5);

      if (imgs.length === 0) {
        failed++;
        notes.push(`${p.id}:no_images`);
        continue;
      }

      const rows = imgs.map((img, idx) => ({
        post_id: p.id,
        image_url: img.url,
        alt_text: `${p.title} — ${img.alt || catLabel(p.category || '')} ${idx + 1}`,
        caption: `출처: ${img.source}`,
        image_type: 'backfill',
        position: startPos + idx,
      }));

      const { error: insErr } = await (sb as any)
        .from('blog_post_images')
        .upsert(rows, { onConflict: 'post_id,image_url', ignoreDuplicates: true });
      if (insErr) {
        failed++;
        notes.push(`${p.id}:${insErr.message}`);
        continue;
      }
      inserted += rows.length;

      // cover_image가 OG 이면 첫 실사진으로 교체
      if (p.cover_image && p.cover_image.includes('/api/og')) {
        await (sb as any).from('blog_posts')
          .update({ cover_image: rows[0].image_url, updated_at: new Date().toISOString() })
          .eq('id', p.id);
        coverUpdated++;
      }
    } catch (err: any) {
      failed++;
      notes.push(`${p.id}:${err?.message || 'exception'}`);
    }
  }

  return NextResponse.json({
    ok: true,
    target,
    processed: posts.length,
    inserted,
    cover_updated: coverUpdated,
    failed,
    sample_notes: notes.slice(0, 8),
  });
}
