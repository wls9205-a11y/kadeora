import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 시리즈 슬러그 → 타이틀 키워드 매핑
// 시리즈 title/slug에서 자동으로 키워드를 추출하고,
// 블로그 제목에 해당 키워드가 포함되면 매칭
const SERIES_KEYWORD_MAP: Record<string, string[]> = {
  // 투자 가이드 시리즈
  'isa': ['ISA', 'isa', '개인종합자산', '중개형ISA'],
  'etf': ['ETF', 'etf', '상장지수', '인덱스펀드'],
  'dividend': ['배당', '배당주', '배당금', '고배당', '배당수익'],
  'value-investing': ['가치투자', '저평가', 'PER', 'PBR', '내재가치', '밸류'],
  'chart-analysis': ['차트분석', '기술적분석', '캔들', '이동평균', '볼린저', 'RSI', 'MACD', '매매기법'],
  'tax-saving': ['절세', '세금', '양도세', '증여세', '종합소득세', '세액공제', '소득공제'],
  'real-estate-tax': ['부동산세', '취득세', '재산세', '종부세', '종합부동산세'],
  // 부동산 시리즈
  'subscription-guide': ['청약', '청약가점', '청약통장', '특별공급', '일반공급', '당첨'],
  'redevelopment': ['재개발', '재건축', '정비사업', '조합', '관리처분'],
  'unsold': ['미분양', '악성미분양', '준공후미분양'],
  // 지역/아파트 분석
  'apt-analysis': ['아파트분석', '단지분석', '실거래분석', '시세분석'],
  'region-analysis': ['지역분석', '부동산전망', '투자전망'],
};

export const GET = withCronAuth(async (req: NextRequest) => {
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
    // 명시적 키워드 + 시리즈 제목에서 추출한 키워드
    const explicit = SERIES_KEYWORD_MAP[s.slug] || [];
    const fromTitle = s.title.split(/[\s·\-:,/]+/).filter((w: string) => w.length >= 2);
    const keywords = [...new Set([...explicit, ...fromTitle])];
    return { id: s.id, slug: s.slug, keywords };
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
  const assignments: { postId: string; seriesId: string }[] = [];

  for (const post of unassigned) {
    const title = post.title || '';
    let matched: { id: string; score: number } | null = null;

    for (const m of matchers) {
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
  const bySeriesMap = new Map<string, string[]>();
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
    let nextOrder = (maxRow?.series_order || 0) + 1;

    // 배치 업데이트
    for (let i = 0; i < postIds.length; i += batchSize) {
      const batch = postIds.slice(i, i + batchSize);
      for (let j = 0; j < batch.length; j++) {
        await sb.from('blog_posts')
          .update({ series_id: seriesId, series_order: nextOrder + j })
          .eq('id', batch[j]);
      }
      nextOrder += batch.length;
    }
    totalAssigned += postIds.length;

    // post_count 업데이트
    const { count } = await sb.from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', seriesId)
      .eq('is_published', true);
    await sb.from('blog_series').update({ post_count: count || 0 }).eq('id', seriesId);
  }

  console.log(`[blog-series-assign] ${totalAssigned}건 할당 (${bySeriesMap.size}개 시리즈)`);

  return NextResponse.json({
    ok: true,
    assigned: totalAssigned,
    series: bySeriesMap.size,
    scanned: unassigned.length,
  });
});
