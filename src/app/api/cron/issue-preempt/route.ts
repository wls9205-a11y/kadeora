export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * issue-preempt 크론 — 분양 전 단계 이슈 선점 감지
 *
 * Phase 1: apt_subscriptions 신규 → 블로그 미존재 감지 → issue_alerts 자동 생성
 * Phase 2: apt_sites active 중 블로그 미존재 → 선점 기회
 * Phase 3: 네이버 DataLab 검색량 스파이크 모니터링
 * Phase 4: 시공사 홈페이지 분양예정 크롤링 (두산위브, 현대건설 등)
 *
 * 주기: 매 2시간
 * 비용: Naver DataLab API 호출 (무료 일 1000건)
 */

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

/* ═══════════ Phase 1: apt_subscriptions 신규 감지 ═══════════ */

async function detectNewSubscriptions(sb: any): Promise<any[]> {
  const results: any[] = [];

  // 최근 7일 내 추가/변경된 apt_subscriptions 중 issue_alerts에 없는 것
  const since7d = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
  const { data: newSubs } = await sb.from('apt_subscriptions')
    .select('house_manage_no, house_nm, region_nm, supply_addr, tot_supply_hshld_co, rcept_bgnde, rcept_endde, constructor_nm, developer_nm, is_price_limit, pblanc_url')
    .gte('updated_at', since7d)
    .not('house_nm', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (!newSubs || newSubs.length === 0) return results;

  for (const sub of newSubs) {
    if (!sub.house_nm || sub.house_nm.length < 3) continue;

    // 이미 issue_alerts에 있는지 체크 (제목 유사도)
    const { data: existing } = await (sb as any).from('issue_alerts')
      .select('id')
      .ilike('title', `%${sub.house_nm.slice(0, 15)}%`)
      .gte('detected_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;

    // 블로그 존재 여부 체크
    const { count: blogCount } = await sb.from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .ilike('title', `%${sub.house_nm.slice(0, 10)}%`);

    const isLotto = sub.is_price_limit || (sub.house_nm || '').includes('무순위');
    const baseScore = isLotto ? 55 : (blogCount === 0 ? 45 : 30);
    const multiplier = blogCount === 0 ? 1.25 : 1.0; // 선점 기회 증폭

    const finalScore = Math.min(Math.round(baseScore * multiplier), 100);

    // issue_alerts INSERT
    const { error } = await (sb as any).from('issue_alerts').insert({
      title: `[분양] ${sub.house_nm} — ${sub.region_nm} ${sub.tot_supply_hshld_co || '?'}세대`,
      summary: `${sub.house_nm} (${sub.region_nm} ${sub.supply_addr || ''}) 청약접수: ${sub.rcept_bgnde || '미정'}~${sub.rcept_endde || '미정'}. 시공: ${sub.constructor_nm || '미정'}. 총 ${sub.tot_supply_hshld_co || '?'}세대.${sub.is_price_limit ? ' 분양가상한제 적용.' : ''}`,
      category: 'apt',
      sub_category: isLotto ? 'lotto_cheongak' : 'cheongak',
      issue_type: isLotto ? 'lotto_cheongak' : 'new_subscription',
      source_type: 'apt_subscription',
      source_urls: sub.pblanc_url ? [sub.pblanc_url] : [],
      detected_keywords: [
        '분양', '청약',
        ...(isLotto ? ['로또청약', '분양가상한제'] : []),
        ...(sub.constructor_nm ? [sub.constructor_nm] : []),
      ],
      related_entities: [sub.house_nm],
      raw_data: {
        house_manage_no: sub.house_manage_no,
        total_units: sub.tot_supply_hshld_co,
        constructor: sub.constructor_nm,
        developer: sub.developer_nm,
        region: sub.region_nm,
        existing_posts: blogCount || 0,
        is_breaking: true,
        has_news: false,
        source_type: 'apt_subscription',
      },
      base_score: baseScore,
      multiplier,
      penalty_rate: 0,
      final_score: finalScore,
      score_breakdown: {
        분양감지: baseScore,
        ...(blogCount === 0 ? { 선점기회: 1.25 } : {}),
        ...(isLotto ? { 로또청약: 10 } : {}),
      },
      is_auto_publish: finalScore >= 40,
      detected_at: new Date().toISOString(),
    });

    if (!error) {
      results.push({ type: 'subscription', name: sub.house_nm, score: finalScore });
    }
  }

  return results;
}

/* ═══════════ Phase 2: apt_sites 블로그 미존재 선점 ═══════════ */

async function detectUncoveredSites(sb: any): Promise<any[]> {
  const results: any[] = [];

  // RPC: 블로그도 issue_alert도 없는 active 단지를 random 순으로 반환
  let sites: any[] = [];
  try {
    const { data } = await (sb as any).rpc('get_uncovered_apt_sites', { lim: 15 });
    sites = data || [];
  } catch {
    // RPC 없으면 폴백: 최신순 조회 후 수동 필터
    const { data: activeSites } = await sb.from('apt_sites')
      .select('id, name, region, sigungu, total_units, builder, interest_count')
      .eq('status', 'active')
      .not('name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60);
    sites = activeSites || [];
  }

  if (sites.length === 0) return results;

  let created = 0;
  for (const site of sites) {
    if (created >= 15) break;
    if (!site.name || site.name.length < 3) continue;

    // RPC 폴백 경로일 때만 추가 체크 필요
    if (sites.length > 15) {
      // 블로그 존재 체크
      const { count } = await sb.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .ilike('title', `%${site.name.slice(0, 12)}%`);
      if (count && count > 0) continue;

      // issue_alerts 중복 체크
      const { data: existingIssue } = await (sb as any).from('issue_alerts')
        .select('id')
        .ilike('title', `%${site.name.slice(0, 12)}%`)
        .gte('detected_at', new Date(Date.now() - 7 * 24 * 3600000).toISOString())
        .limit(1);
      if (existingIssue && existingIssue.length > 0) continue;
    }

    const score = Math.min(42 + (site.interest_count || 0) / 100, 65);

    const { error } = await (sb as any).from('issue_alerts').insert({
      title: `${site.name} — ${site.region} ${site.sigungu || ''} 분석`,
      summary: `${site.name} (${site.region} ${site.sigungu || ''}) ${site.total_units || '?'}세대. 시공: ${site.builder || '미정'}. 아직 카더라 블로그가 없는 활성 단지.`,
      category: 'apt',
      sub_category: 'preempt_coverage',
      issue_type: 'preempt_coverage',
      source_type: 'apt_sites_gap',
      source_urls: [],
      detected_keywords: ['분양', '청약', site.region || ''],
      related_entities: [site.name],
      raw_data: {
        apt_site_id: site.id,
        total_units: site.total_units,
        builder: site.builder,
        region: site.region,
        interest_count: site.interest_count,
        existing_posts: 0,
        is_breaking: false,
        has_news: false,
        source_type: 'apt_sites_gap',
      },
      base_score: Math.round(score),
      multiplier: 1.25,
      penalty_rate: 0,
      final_score: Math.round(score * 1.25),
      score_breakdown: { 미커버단지: Math.round(score), 선점기회: 1.25 },
      is_auto_publish: true,
      detected_at: new Date().toISOString(),
    });

    if (!error) {
      results.push({ type: 'uncovered', name: site.name, score: Math.round(score * 1.25) });
      created++;
    }
  }

  return results;
}

/* ═══════════ Phase 3: 네이버 DataLab 검색량 스파이크 ═══════════ */

async function detectNaverSpikes(sb: any): Promise<any[]> {
  const results: any[] = [];
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return results;

  // apt_sites에서 관심도 높은 단지 30개 선발
  const { data: topSites } = await sb.from('apt_sites')
    .select('id, name, region, total_units, interest_count')
    .eq('status', 'active')
    .not('name', 'is', null)
    .order('interest_count', { ascending: false, nullsFirst: false })
    .limit(30);

  if (!topSites || topSites.length === 0) return results;

  // 5개씩 그룹으로 나눠서 DataLab API 호출 (API 제한 고려)
  const groups = [];
  for (let i = 0; i < Math.min(topSites.length, 25); i += 5) {
    groups.push(topSites.slice(i, i + 5));
  }

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 7 * 24 * 3600000).toISOString().slice(0, 10);

  for (const group of groups) {
    try {
      const keywordGroups = group.map((s: any) => ({
        groupName: s.name.slice(0, 20),
        keywords: [s.name],
      }));

      const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        body: JSON.stringify({ startDate, endDate, timeUnit: 'date', keywordGroups }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const result of (data.results || [])) {
        const dPoints = result.data || [];
        if (dPoints.length < 3) continue;

        const recent = dPoints[dPoints.length - 1]?.ratio || 0;
        const prev = dPoints[dPoints.length - 3]?.ratio || 1;
        const spikeRatio = prev > 0 ? (recent / prev) * 100 : 0;

        if (spikeRatio < 200) continue; // 200%+ 스파이크만

        const siteName = result.title || result.keywords?.[0] || '';
        const site = group.find((s: any) => s.name.includes(siteName) || siteName.includes(s.name));
        if (!site) continue;

        // 블로그 존재 체크
        const { count: blogCount } = await sb.from('blog_posts')
          .select('id', { count: 'exact', head: true })
          .eq('is_published', true)
          .ilike('title', `%${site.name.slice(0, 10)}%`);

        // 이미 24시간 내 같은 이슈 있으면 스킵
        const { data: existingIssue } = await (sb as any).from('issue_alerts')
          .select('id')
          .ilike('title', `%${site.name.slice(0, 12)}%`)
          .gte('detected_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .limit(1);
        if (existingIssue && existingIssue.length > 0) continue;

        const baseScore = Math.min(35 + Math.round(spikeRatio / 20), 60);
        const multiplier = (blogCount === 0 ? 1.3 : 1.0) * (spikeRatio >= 500 ? 1.4 : 1.2);
        const finalScore = Math.min(Math.round(baseScore * multiplier), 100);

        const { error } = await (sb as any).from('issue_alerts').insert({
          title: `[급상승] ${site.name} 검색량 ${Math.round(spikeRatio)}% 급증 — ${site.region}`,
          summary: `네이버 검색량 ${Math.round(spikeRatio)}% 급증 감지. ${site.name} (${site.region}) ${site.total_units || '?'}세대.${blogCount === 0 ? ' 카더라 블로그 미존재 — 선점 기회.' : ''}`,
          category: 'apt',
          sub_category: 'search_spike',
          issue_type: 'search_spike',
          source_type: 'naver_datalab',
          source_urls: [],
          detected_keywords: ['검색급증', site.region || '', '분양'],
          related_entities: [site.name],
          raw_data: {
            apt_site_id: site.id,
            search_spike: Math.round(spikeRatio),
            total_units: site.total_units,
            region: site.region,
            existing_posts: blogCount || 0,
            is_breaking: true,
            source_type: 'naver_datalab',
          },
          base_score: baseScore,
          multiplier: Math.round(multiplier * 100) / 100,
          penalty_rate: 0,
          final_score: finalScore,
          score_breakdown: {
            검색스파이크: baseScore,
            ...(blogCount === 0 ? { 선점기회: 1.3 } : {}),
            [`검색${Math.round(spikeRatio)}%`]: spikeRatio >= 500 ? 1.4 : 1.2,
          },
          is_auto_publish: finalScore >= 40,
          detected_at: new Date().toISOString(),
        });

        if (!error) {
          results.push({ type: 'naver_spike', name: site.name, spike: Math.round(spikeRatio), score: finalScore });
        }
      }
    } catch {}

    // API rate limit 방지
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

/* ═══════════ Phase 4: 시공사 분양예정 — DISABLED ═══════════ */
/* 시공사 사이트가 JS 렌더링이라 정적 fetch로 실제 분양 목록 파싱 불가.
   Headless browser(Puppeteer) 없이는 구현 불가 → 추후 별도 구현 */

async function detectBuilderUpcoming(_sb: any): Promise<any[]> {
  return []; // 비활성화
}

/* ═══════════ [L2-7] Phase 5: trending_keywords gap 감지 ═══════════ */
/* heat_score ≥ 70 + 12h 내 업데이트 + 블로그 미존재 → issue_alerts 선점 삽입 */

async function detectTrendingKeywordGaps(sb: any): Promise<any[]> {
  const results: any[] = [];
  try {
    const since12h = new Date(Date.now() - 12 * 3600000).toISOString();
    const { data: trending } = await sb.from('trending_keywords')
      .select('keyword, heat_score, category, rank')
      .gte('heat_score', 70)
      .gte('updated_at', since12h)
      .in('category', ['stock', 'apt', 'search'])
      .order('heat_score', { ascending: false })
      .limit(30);

    if (!trending || trending.length === 0) return results;

    for (const t of trending) {
      if (!t.keyword || t.keyword.length < 2) continue;

      // 블로그 미존재 체크
      const kwSlice = t.keyword.slice(0, 14);
      const { count: blogCount } = await sb.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .or(`title.ilike.%${kwSlice}%,tags.cs.{${t.keyword}}`);
      if (blogCount && blogCount > 0) continue;

      // issue_alerts 중복 체크 (7일 내 같은 키워드)
      const { data: existing } = await (sb as any).from('issue_alerts')
        .select('id')
        .ilike('title', `%${kwSlice}%`)
        .gte('detected_at', new Date(Date.now() - 7 * 24 * 3600000).toISOString())
        .limit(1);
      if (existing && existing.length > 0) continue;

      const baseScore = 50;
      const multiplier = 1.5;
      const finalScore = Math.min(Math.round(baseScore * multiplier), 100);
      const cat = t.category === 'search' ? 'general' : t.category;

      const { error } = await (sb as any).from('issue_alerts').insert({
        title: `[급상승] ${t.keyword} — heat ${Math.round(t.heat_score)}`,
        summary: `trending_keywords에서 heat score ${Math.round(t.heat_score)}로 감지된 급상승 키워드. 카더라 블로그 미존재 — 선점 기회.`,
        category: cat,
        sub_category: 'trending_gap',
        issue_type: 'search_spike',
        source_type: 'trending_keywords',
        source_urls: [],
        detected_keywords: [t.keyword, '급상승', t.category || ''].filter(Boolean),
        related_entities: [t.keyword],
        raw_data: {
          heat_score: t.heat_score,
          trending_category: t.category,
          rank: t.rank,
          existing_posts: 0,
          is_breaking: true,
          source_type: 'trending_keywords',
        },
        base_score: baseScore,
        multiplier,
        penalty_rate: 0,
        final_score: finalScore,
        score_breakdown: { trending_gap: baseScore, 선점기회: multiplier },
        is_auto_publish: true,
        detected_at: new Date().toISOString(),
      });

      if (!error) {
        results.push({ type: 'trending_gap', keyword: t.keyword, heat: t.heat_score, score: finalScore });
      }
    }
  } catch (err: any) {
    console.error('[issue-preempt] trending gap phase error:', err.message);
  }
  return results;
}

/* ═══════════ 메인 핸들러 ═══════════ */

async function handler(_req: NextRequest) {
  const result = await withCronLogging('issue-preempt', async () => {
  const sb = getSupabaseAdmin();

  // 5개 Phase 병렬 실행 (Phase 5: [L2-7] trending_keywords gap)
  const [subResults, uncoveredResults, spikeResults, builderResults, trendingResults] = await Promise.allSettled([
    detectNewSubscriptions(sb),
    detectUncoveredSites(sb),
    detectNaverSpikes(sb),
    detectBuilderUpcoming(sb),
    detectTrendingKeywordGaps(sb),
  ]);

  const allResults = [
    ...(subResults.status === 'fulfilled' ? subResults.value : []),
    ...(uncoveredResults.status === 'fulfilled' ? uncoveredResults.value : []),
    ...(spikeResults.status === 'fulfilled' ? spikeResults.value : []),
    ...(builderResults.status === 'fulfilled' ? builderResults.value : []),
    ...(trendingResults.status === 'fulfilled' ? trendingResults.value : []),
  ];

  // 새 이슈 발견 시 issue-draft 즉시 트리거
  if (allResults.length > 0) {
    try {
      const draftUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app'}/api/cron/issue-draft`;
      fetch(draftUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch {}
  }

  const trendingCount = trendingResults.status === 'fulfilled' ? trendingResults.value.length : 0;
  console.log(`[issue-preempt] total=${allResults.length} sub=${subResults.status === 'fulfilled' ? subResults.value.length : 0} uncovered=${uncoveredResults.status === 'fulfilled' ? uncoveredResults.value.length : 0} spikes=${spikeResults.status === 'fulfilled' ? spikeResults.value.length : 0} builders=${builderResults.status === 'fulfilled' ? builderResults.value.length : 0} trending=${trendingCount}`);

  return {
    processed: allResults.length,
    created: allResults.length,
    failed: 0,
    metadata: {
      subscriptions: subResults.status === 'fulfilled' ? subResults.value.length : 0,
      uncovered: uncoveredResults.status === 'fulfilled' ? uncoveredResults.value.length : 0,
      spikes: spikeResults.status === 'fulfilled' ? spikeResults.value.length : 0,
      builders: builderResults.status === 'fulfilled' ? builderResults.value.length : 0,
      trending_gaps: trendingCount,
    },
  };
  }); // withCronLogging
  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
