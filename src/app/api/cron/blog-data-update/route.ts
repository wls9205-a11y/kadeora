import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * 블로그 데이터 갱신 크론 — 주 1회 (일 06시)
 * 조회수 상위 500글의 실데이터(시세, 거래 이력)를 최신화
 * updated_at 갱신 → 검색엔진에 "최신 콘텐츠" 시그널
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-data-update', async () => {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    // 조회수 상위 300글 중 apt 카테고리 (실데이터 갱신 대상)
    const { data: topPosts } = await admin.from('blog_posts')
      .select('id, title, slug, category, tags')
      .eq('is_published', true)
      .in('category', ['apt', 'unsold'])
      .order('view_count', { ascending: false })
      .limit(300);

    if (!topPosts || topPosts.length === 0) {
      return { processed: 0, metadata: { reason: 'no_apt_posts' } };
    }

    let updated = 0;
    const batch: { id: number; meta_description: string }[] = [];

    for (const post of topPosts.slice(0, 50)) { // 한 번에 50개씩
      try {
        // 태그에서 단지명 추출
        const aptName = (post.tags || [])[0];
        if (!aptName) continue;

        // 최신 시세 조회
        const { data: cp } = await (admin as any).from('apt_complex_profiles')
          .select('latest_sale_price, latest_sale_date, avg_sale_price_pyeong, jeonse_ratio, price_change_1y')
          .eq('apt_name', aptName)
          .maybeSingle();

        if (!cp || !cp.latest_sale_price) continue;

        // meta_description에 최신 수치 반영
        const priceTxt = cp.avg_sale_price_pyeong ? `평당 ${cp.avg_sale_price_pyeong.toLocaleString()}만원` : '';
        const jeonse = cp.jeonse_ratio ? `전세가율 ${cp.jeonse_ratio}%` : '';
        const change = cp.price_change_1y !== null ? `1년 ${cp.price_change_1y > 0 ? '+' : ''}${cp.price_change_1y}%` : '';
        const desc = `${aptName} ${priceTxt} ${jeonse} ${change} — 카더라 부동산 실데이터 분석`.replace(/\s+/g, ' ').trim().slice(0, 155);

        await admin.from('blog_posts').update({
          meta_description: desc,
          data_date: cp.latest_sale_date || now.slice(0, 10),
          updated_at: now,
        }).eq('id', post.id);

        updated++;
      } catch {}
    }

    return { processed: updated, metadata: { total: topPosts.length, updated } };
  });

  return NextResponse.json(result);
}
