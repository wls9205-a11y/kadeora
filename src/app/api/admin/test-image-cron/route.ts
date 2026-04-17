import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * 임시 크론 테스트 엔드포인트 — 검증 후 즉시 삭제
 * GET /api/admin/test-image-cron?target=apt|blog&limit=3
 */
export async function GET(req: NextRequest) {
  // 임시 테스트 — 읽기 전용, 검증 후 즉시 삭제
  const target = req.nextUrl.searchParams.get('target') || 'apt';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '3'), 5);
  const start = Date.now();
  const sb = getSupabaseAdmin();

  if (target === 'blog') {
    // blog-generate-images 로직 미니 테스트
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

    // 1. LIKE 패턴 매칭 확인
    const { data: posts, count } = await sb
      .from('blog_posts')
      .select('id, title, category, cover_image', { count: 'exact' })
      .eq('is_published', true)
      .like('cover_image', '%/api/og%')
      .order('created_at', { ascending: false })
      .limit(limit);

    // 2. 네이버 이미지 검색 테스트
    let naverTest = null;
    if (posts?.[0] && NAVER_CLIENT_ID) {
      const kw = (posts[0].title || '').replace(/[|—·()]/g, ' ').split(/\s+/).filter((w: string) => w.length >= 2).slice(0, 3).join(' ');
      const res = await fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(kw)}&display=8&sort=sim&filter=large`, {
        headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      naverTest = {
        query: kw,
        returned: data?.items?.length || 0,
        sample: (data?.items || []).slice(0, 2).map((i: any) => ({ title: (i.title || '').replace(/<[^>]*>/g, '').slice(0, 50), url: (i.link || '').slice(0, 80), w: i.sizewidth, h: i.sizeheight })),
      };
    }

    return NextResponse.json({
      target: 'blog',
      like_matched: count,
      sample_posts: (posts || []).map((p: any) => ({ id: p.id, title: (p.title || '').slice(0, 40), cover: (p.cover_image || '').slice(0, 60) })),
      naver_test: naverTest,
      elapsed: `${Date.now() - start}ms`,
    });
  }

  // apt-image-crawl 로직 미니 테스트
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

  // 1. 이미지 부족 현장 조회
  const { data: sites } = await (sb as any)
    .from('apt_sites')
    .select('id, name, region, images')
    .eq('is_active', true)
    .or('images.eq.[],images.is.null')
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (!sites?.length) {
    // 빈배열 없으면 1~2장 현장
    const { data: lowSites } = await (sb as any)
      .from('apt_sites')
      .select('id, name, region, images')
      .eq('is_active', true)
      .order('updated_at', { ascending: true })
      .limit(limit);
    
    const filtered = (lowSites || []).filter((s: any) => Array.isArray(s.images) && s.images.length < 3);
    
    if (!filtered.length) {
      return NextResponse.json({ target: 'apt', message: 'No sites need images', elapsed: `${Date.now() - start}ms` });
    }
  }

  const targetSites = sites || [];
  const results: any[] = [];

  for (const site of targetSites.slice(0, limit)) {
    // 네이버 부동산 API 테스트
    let landPhotos = 0;
    try {
      const searchRes = await fetch(`https://m.land.naver.com/search/result/${encodeURIComponent(site.name)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36', Referer: 'https://m.land.naver.com/' },
        signal: AbortSignal.timeout(5000),
      });
      if (searchRes.ok) {
        const html = await searchRes.text();
        const match = html.match(/complexNo['":\s]+(\d{5,})/);
        if (match) {
          const photoRes = await fetch(`https://new.land.naver.com/api/complexes/${match[1]}/photos?photoType=all&page=1&displayCount=10`, {
            headers: { 'User-Agent': 'Mozilla/5.0', Referer: `https://new.land.naver.com/complexes/${match[1]}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          if (photoRes.ok) {
            const d = await photoRes.json();
            landPhotos = (d?.photos || d?.photoList || []).length;
          }
        }
      }
    } catch {}

    // 네이버 이미지 검색 테스트
    let searchImgs = 0;
    if (NAVER_CLIENT_ID) {
      try {
        const res = await fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(site.name + ' 아파트 조감도')}&display=5&sort=sim&filter=large`, {
          headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const d = await res.json();
          searchImgs = (d?.items || []).length;
        }
      } catch {}
    }

    results.push({
      name: site.name,
      region: site.region,
      current_imgs: Array.isArray(site.images) ? site.images.length : 0,
      land_photos: landPhotos,
      search_imgs: searchImgs,
    });
  }

  return NextResponse.json({
    target: 'apt',
    sites_found: targetSites.length,
    results,
    elapsed: `${Date.now() - start}ms`,
  });
}
