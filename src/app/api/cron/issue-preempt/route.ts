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

  // active apt_sites 중 블로그가 없는 것 (랜덤 10개씩 처리)
  // 서브쿼리 불가 → 2단계 조회
  const { data: activeSites } = await sb.from('apt_sites')
    .select('id, name, region, sigungu, total_units, builder, status, interest_count')
    .eq('status', 'active')
    .not('name', 'is', null)
    .order('interest_count', { ascending: false, nullsFirst: false })
    .limit(30);

  if (!activeSites) return results;

  let checked = 0;
  for (const site of activeSites) {
    if (checked >= 5) break; // 실행당 최대 5건
    if (!site.name || site.name.length < 3) continue;

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

    const score = Math.min(42 + (site.interest_count || 0) / 100, 65);

    const { error } = await (sb as any).from('issue_alerts').insert({
      title: `[선점] ${site.name} — ${site.region} ${site.sigungu || ''} 분석`,
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
      checked++;
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

/* ═══════════ Phase 4: 시공사 분양예정 페이지 크롤 ═══════════ */

async function detectBuilderUpcoming(sb: any): Promise<any[]> {
  const results: any[] = [];

  // 두산위브 분양예정 RSS 크롤
  const BUILDER_PAGES = [
    { name: '두산위브', url: 'https://www.weveapt.co.kr/lttot/lttotDe/lttotDeList.do', brand: '위브' },
    { name: '현대건설', url: 'https://www.hillstate.co.kr/city/sub01.do', brand: '힐스테이트' },
    { name: 'GS건설', url: 'https://xi.co.kr/overview/business_map', brand: '자이' },
  ];

  for (const builder of BUILDER_PAGES) {
    try {
      const res = await fetch(builder.url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kadeora/1.0)' },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // HTML에서 단지명 추출 (제목 패턴)
      const namePattern = new RegExp(`([가-힣]{2,15}\\s*${builder.brand}[가-힣\\s]{0,20})`, 'g');
      let match;
      const found = new Set<string>();
      while ((match = namePattern.exec(html)) !== null) {
        const name = match[1].trim().replace(/\s+/g, ' ');
        if (name.length >= 5 && name.length <= 30) found.add(name);
      }

      for (const name of found) {
        // apt_sites에 이미 있는지 체크
        const { count: siteCount } = await sb.from('apt_sites')
          .select('id', { count: 'exact', head: true })
          .ilike('name', `%${name.slice(0, 10)}%`);
        if (siteCount && siteCount > 0) continue;

        // 이미 issue_alerts에 있는지
        const { data: existing } = await (sb as any).from('issue_alerts')
          .select('id')
          .ilike('title', `%${name.slice(0, 12)}%`)
          .gte('detected_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString())
          .limit(1);
        if (existing && existing.length > 0) continue;

        const { error } = await (sb as any).from('issue_alerts').insert({
          title: `[사전감지] ${name} — ${builder.name} 분양예정`,
          summary: `${builder.name} 홈페이지에서 ${name} 분양예정 감지. 아직 청약홈/카더라에 등록되지 않은 신규 프로젝트.`,
          category: 'apt',
          sub_category: 'pre_announcement',
          issue_type: 'pre_announcement',
          source_type: 'builder_site',
          source_urls: [builder.url],
          detected_keywords: ['분양예정', builder.brand, builder.name],
          related_entities: [name],
          raw_data: {
            builder: builder.name,
            brand: builder.brand,
            existing_posts: 0,
            is_breaking: false,
            has_news: false,
            source_type: 'builder_site',
          },
          base_score: 50,
          multiplier: 1.3,
          penalty_rate: 0,
          final_score: 65,
          score_breakdown: { 사전감지: 50, 선점기회: 1.3 },
          is_auto_publish: true,
          detected_at: new Date().toISOString(),
        });

        if (!error) {
          results.push({ type: 'builder', name, builder: builder.name, score: 65 });
        }
      }
    } catch {}
  }

  return results;
}

/* ═══════════ 메인 핸들러 ═══════════ */

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 4개 Phase 병렬 실행
  const [subResults, uncoveredResults, spikeResults, builderResults] = await Promise.allSettled([
    detectNewSubscriptions(sb),
    detectUncoveredSites(sb),
    detectNaverSpikes(sb),
    detectBuilderUpcoming(sb),
  ]);

  const allResults = [
    ...(subResults.status === 'fulfilled' ? subResults.value : []),
    ...(uncoveredResults.status === 'fulfilled' ? uncoveredResults.value : []),
    ...(spikeResults.status === 'fulfilled' ? spikeResults.value : []),
    ...(builderResults.status === 'fulfilled' ? builderResults.value : []),
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

  console.log(`[issue-preempt] total=${allResults.length} sub=${subResults.status === 'fulfilled' ? subResults.value.length : 0} uncovered=${uncoveredResults.status === 'fulfilled' ? uncoveredResults.value.length : 0} spikes=${spikeResults.status === 'fulfilled' ? spikeResults.value.length : 0} builders=${builderResults.status === 'fulfilled' ? builderResults.value.length : 0}`);

  return NextResponse.json({
    processed: allResults.length,
    created: allResults.length,
    failed: 0,
    results: allResults,
    metadata: {
      subscriptions: subResults.status === 'fulfilled' ? subResults.value.length : 0,
      uncovered: uncoveredResults.status === 'fulfilled' ? uncoveredResults.value.length : 0,
      spikes: spikeResults.status === 'fulfilled' ? spikeResults.value.length : 0,
      builders: builderResults.status === 'fulfilled' ? builderResults.value.length : 0,
    },
  });
}

export const GET = withCronAuth(handler);
