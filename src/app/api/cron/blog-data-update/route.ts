import { NextRequest, NextResponse } from 'next/server';
import { priceChangeCompact, PRICE_CHANGE_COLS } from '@/lib/apt/price-change';
import { pickProfileByTags } from '@/lib/apt/profile-match';
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

        /* 최신 시세 조회.
         * ⚠️ `apt_name` «만» 으로 고르면 오집이 난다 — 이름 1,833개가 복수 시군구에 걸쳐 있고
         *    (한 이름 최대 81곳) 거래 22%가 그 이름들이다. 여기서 고른 시세는 아래에서
         *    `meta_description` 으로 «검색 결과에» 나가므로, 틀리면 색인에 남는다.
         *    `.maybeSingle()` 은 그 위험을 «감춘다» — 여러 건이면 조용히 하나를 집는다.
         * → 후보를 다 받아 태그로 가린다. 못 가리면 이 글은 건너뛴다 (lib/apt/profile-match.ts). */
        const { data: cps } = await (admin as any).from('apt_complex_profiles')
          .select(`sigungu, region_nm, latest_sale_price, latest_sale_date, avg_sale_price_pyeong, jeonse_ratio, ${PRICE_CHANGE_COLS}`)
          .eq('apt_name', aptName)
          .limit(20);

        const cp = pickProfileByTags(cps as any[], post.tags as string[]);
        if (!cp || !cp.latest_sale_price) continue;

        // meta_description에 최신 수치 반영
        const priceTxt = cp.avg_sale_price_pyeong ? `평당 ${cp.avg_sale_price_pyeong.toLocaleString()}만원` : '';
        const jeonse = cp.jeonse_ratio ? `전세가율 ${cp.jeonse_ratio}%` : '';
        // ⚠️ 이 문자열은 blog_posts.meta_description 으로 «검색 결과에» 나간다.
        //    평형을 뗀 %는 「단지 전체가 그만큼 움직였다」로 읽힌다 (lib/apt/price-change.ts).
        //    근거가 없으면 아예 넣지 않는다 — 155자 예산을 거짓말로 채우지 않는다.
        // ⚠️ 위 조회가 `apt_name` 만으로 단지를 고른다. 같은 이름이 복수 시군구에 걸친
        //    경우(이름 1,833개)에는 다른 도시 단지를 집을 수 있다 — 별건으로 남아 있다.
        const pc = priceChangeCompact(cp);
        const change = pc ? `1년 ${pc}` : '';
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
