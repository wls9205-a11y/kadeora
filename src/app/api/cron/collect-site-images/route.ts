import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const BATCH_SIZE = 30; // 네이버 API 호출 제한 고려 (25,000/일)

async function searchNaverImages(query: string, display = 3): Promise<{ title: string; link: string; thumbnail: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      title: (item.title || '').replace(/<[^>]*>/g, ''),
      link: item.link,
      thumbnail: item.thumbnail,
    }));
  } catch {
    return [];
  }
}

async function handler(req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let collected = 0;
  let skipped = 0;
  let errors: string[] = [];

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID/SECRET not set' }, { status: 200 });
  }

  // 이미지가 없는 현장 중 score 40+ 우선
  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, region, sigungu, site_type, images')
    .eq('is_active', true)
    .gte('content_score', 25)
    .order('interest_count', { ascending: false })
    .limit(BATCH_SIZE * 2); // 여유있게 가져와서 이미지 없는 것만 필터

  const targets = (sites || []).filter((s: any) => {
    const imgs = s.images;
    return !imgs || !Array.isArray(imgs) || imgs.length === 0;
  }).slice(0, BATCH_SIZE);

  for (const site of targets) {
    try {
      const queries = [
        `${site.name} 투시도`,
        `${site.name} 조감도`,
        `${site.name} 아파트`,
      ];

      let allImages: any[] = [];
      for (const q of queries) {
        const results = await searchNaverImages(q, 2);
        allImages.push(...results);
        // API 부하 방지
        await new Promise(r => setTimeout(r, 100));
      }

      // 중복 제거 (URL 기준)
      const seen = new Set<string>();
      const unique = allImages.filter(img => {
        if (seen.has(img.link)) return false;
        seen.add(img.link);
        return true;
      }).slice(0, 5); // 최대 5장

      if (unique.length === 0) {
        skipped++;
        continue;
      }

      const imageData = unique.map(img => ({
        url: img.link,
        thumbnail: img.thumbnail,
        source: 'naver_search',
        caption: img.title,
        collected_at: new Date().toISOString(),
      }));

      await sb.from('apt_sites').update({
        images: imageData,
        updated_at: new Date().toISOString(),
      }).eq('id', site.id);

      collected++;
    } catch (e: any) {
      errors.push(`${site.name}: ${e.message}`);
    }
  }

  // content_score 재계산 (이미지 추가분)
  for (const site of targets) {
    try {
      await sb.rpc('calculate_site_content_score', { p_site_id: site.id });
    } catch {}
  }

  return NextResponse.json({
    success: true,
    collected,
    skipped,
    total_checked: targets.length,
    elapsed: `${Date.now() - start}ms`,
    errors: errors.length ? errors.slice(0, 5) : undefined,
  });
}

export const GET = withCronAuth(handler);
