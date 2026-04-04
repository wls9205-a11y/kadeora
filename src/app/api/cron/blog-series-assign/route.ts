export const maxDuration = 120;
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 시리즈 ID → 키워드 매핑 (DB의 실제 시리즈 ID 기준)
// cat: 해당 시리즈에 할당 가능한 카테고리 (미지정 시 전체)
const SERIES_KEYWORD_MAP: Record<string, { keywords: string[]; cat?: string[] }> = {
  // 부동산
  'trade-analysis': { keywords: ['실거래', '실거래가', '거래가 TOP', '시세', '평당가', '매매 동향', '거래 동향'], cat: ['apt'] },
  'subscription-analysis': { keywords: ['청약 총정리', '청약', '당첨 전략', '분양', '특별공급', '일반공급', '청약가점', '청약통장'], cat: ['apt'] },
  'apt-beginner-guide': { keywords: ['투자 분석', '투자 가치', '분양 분석', '완전 분석', '실거주 가이드', '투자 전망', '단지 분석', '아파트 분석', '아파트 비교'], cat: ['apt'] },
  'redevelopment-status': { keywords: ['재개발', '재건축', '정비사업', '조합설립', '관리처분', '정비구역'], cat: ['apt'] },
  'unsold-report': { keywords: ['미분양', '잔여세대', '악성미분양', '준공후미분양'], cat: ['apt'] },
  'real-estate-tax': { keywords: ['부동산세', '취득세', '재산세', '종부세', '양도세', '절세', '세금', '세액공제'], cat: ['apt'] },
  // 주식
  'stock-analysis': { keywords: ['종목 분석', '주가 전망', '성장성 분석', '리스크 분석', '밸류에이션', '투자 포인트', '기술적 분석', '기본적 분석', '테마 분석', '관련주', '수혜주'], cat: ['stock'] },
  'stock-comparison': { keywords: ['종목 비교', '주가 비교', '수익률 비교', '배당 비교'], cat: ['stock'] },
  'dividend-investing': { keywords: ['배당', '배당주', '배당금', '고배당', '배당수익'], cat: ['stock'] },
  'finance-basics': { keywords: ['ETF', 'etf', 'ISA', 'isa', '펀드', '재테크', '가치투자', 'PER', 'PBR', 'RSI', 'MACD', '차트분석'] },
};

export const GET = withCronAuth(async (_req: NextRequest) => {
  const sb = getSupabaseAdmin();
  const batchSize = 500;
  let totalAssigned = 0;

  // 1. 모든 활성 시리즈 가져오기
  const { data: seriesList, error: seriesErr } = await sb.from('blog_series')
    .select('id, slug, title, category')
    .eq('is_active', true);

  if (seriesErr || !seriesList?.length) {
    return NextResponse.json({ ok: true, message: '활성 시리즈 없음', assigned: 0 });
  }

  // 2. 시리즈별 키워드 매처 빌드
  const matchers = seriesList.map(s => {
    const config = SERIES_KEYWORD_MAP[s.slug];
    const explicit = config?.keywords || [];
    const allowedCats = config?.cat || null; // null = 모든 카테고리 허용
    const fromTitle = s.title.split(/[\s·\-:,/]+/).filter((w: string) => w.length >= 2);
    const keywords = [...new Set([...explicit, ...fromTitle])];
    return { id: s.id, slug: s.slug, keywords, allowedCats };
  });

  // 3. 미할당 블로그 가져오기 (published, series_id IS NULL)
  const { data: unassigned, error: fetchErr } = await sb.from('blog_posts')
    .select('id, title, category, published_at')
    .eq('is_published', true)
    .is('series_id', null)
    .order('published_at', { ascending: true })
    .limit(2000);

  if (fetchErr || !unassigned?.length) {
    return NextResponse.json({ ok: true, message: '미할당 포스트 없음', assigned: 0 });
  }

  // 4. 매칭
  const assignments: { postId: number; seriesId: string }[] = [];

  for (const post of unassigned) {
    const title = post.title || '';
    let matched: { id: string; score: number } | null = null;

    for (const m of matchers) {
      // 카테고리 필터: 시리즈에 허용 카테고리가 지정된 경우 해당 카테고리만 매칭
      if (m.allowedCats && !m.allowedCats.includes(post.category)) continue;
      let score = 0;
      for (const kw of m.keywords) {
        if (title.includes(kw)) score++;
      }
      if (score > 0 && (!matched || score > matched.score)) {
        matched = { id: m.id, score };
      }
    }

    if (matched && matched.score >= 1) {
      assignments.push({ postId: post.id, seriesId: matched.id });
    }
  }

  if (!assignments.length) {
    return NextResponse.json({ ok: true, message: '매칭 대상 없음', assigned: 0 });
  }

  // 5. 시리즈별로 그룹화 후 series_order 부여
  const bySeriesMap = new Map<string, number[]>();
  for (const a of assignments) {
    const arr = bySeriesMap.get(a.seriesId) || [];
    arr.push(a.postId);
    bySeriesMap.set(a.seriesId, arr);
  }

  for (const [seriesId, postIds] of bySeriesMap) {
    // 현재 시리즈의 max series_order 가져오기
    const { data: maxRow } = await sb.from('blog_posts')
      .select('series_order')
      .eq('series_id', seriesId)
      .order('series_order', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.series_order || 0) + 1;

    // 배치 업데이트 (10건씩 병렬)
    for (let i = 0; i < postIds.length; i += 10) {
      const batch = postIds.slice(i, i + 10);
      await Promise.allSettled(
        batch.map((pid, j) =>
          sb.from('blog_posts')
            .update({ series_id: seriesId, series_order: nextOrder + i + j })
            .eq('id', pid)
        )
      );
    }
    totalAssigned += postIds.length;

    // post_count 업데이트
    const { count } = await sb.from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', seriesId)
      .eq('is_published', true);
    await sb.from('blog_series').update({ post_count: count || 0 }).eq('id', seriesId);
  }

  console.info(`[blog-series-assign] ${totalAssigned}건 할당 (${bySeriesMap.size}개 시리즈)`);

  return NextResponse.json({
    ok: true,
    assigned: totalAssigned,
    series: bySeriesMap.size,
    scanned: unassigned.length,
  });
});
