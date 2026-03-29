import { errMsg } from '@/lib/error-utils';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const BATCH_SIZE = 350; // 네이버 API 25,000/일 → 350건×3쿼리×6회=6,300/일 (한도 내)

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

async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let collected = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID/SECRET not set' }, { status: 200 });
  }

  // 이미지가 없는 현장 조회 (빈 배열 = 미수집)
  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, region, sigungu, site_type, images')
    .eq('is_active', true)
    .order('interest_count', { ascending: false })
    .limit(BATCH_SIZE * 3);

  const targets = (sites || []).filter((s: Record<string, any>) => {
    const imgs = s.images;
    return !imgs || !Array.isArray(imgs) || imgs.length === 0;
  }).slice(0, BATCH_SIZE);

  if (!targets || targets.length === 0) {
    return NextResponse.json({ success: true, collected: 0, message: 'All sites have images' });
  }

  for (const site of targets) {
    try {
      const queries = [
        `${site.name} 투시도`,
        `${site.name} 조감도`,
        `${site.name} 아파트`,
      ];

      const allImages: Record<string, any>[] = [];
      for (const q of queries) {
        const results = await searchNaverImages(q, 2);
        allImages.push(...results);
        // API 부하 방지 (최소 딜레이)
        await new Promise(r => setTimeout(r, 50));
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
    } catch (e: unknown) {
      errors.push(`${site.name}: ${errMsg(e)}`);
    }
  }

  // content_score 재계산 (수집 완료된 것만, 최대 50건 — 시간 절약)
  const recalcTargets = targets.filter((_: any, i: number) => i < 50);
  for (const site of recalcTargets) {
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
