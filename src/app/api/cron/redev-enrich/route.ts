import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

/**
 * redev-enrich — 재개발 프로젝트 데이터 보강 크론
 * 1. blog_count: 관련 블로그 포스트 수 업데이트
 * 2. avg_trade_price: 구역 내 최근 실거래 평균가 연동
 * 3. stage 변경 감지: previous_stage 기록 + last_stage_change 갱신
 *
 * 매일 1회 실행 (KST 15:30 = UTC 06:30)
 */

export const GET = withCronAuth(async (_req: NextRequest) => {
  const sb = getSupabaseAdmin();

  const result = await withCronLogging('redev-enrich', async () => {
    let updated = 0;
    let blogUpdated = 0;
    let tradeUpdated = 0;
    let stageChanged = 0;

    // 1. 활성 프로젝트 조회
    const { data: projects } = await (sb as any).from('redevelopment_projects')
      .select('id, district_name, region, sigungu, stage, previous_stage, blog_count')
      .eq('is_active', true);

    if (!projects?.length) return { processed: 0, created: 0, failed: 0, metadata: {} };

    // 2. 블로그 카운트 업데이트 (배치)
    const { data: blogPosts } = await sb.from('blog_posts')
      .select('tags')
      .eq('is_published', true)
      .eq('category', 'redev');

    const blogCountMap = new Map<string, number>();
    for (const post of (blogPosts || [])) {
      for (const tag of (post.tags || [])) {
        blogCountMap.set(tag, (blogCountMap.get(tag) || 0) + 1);
      }
    }

    for (const p of projects) {
      const newCount = blogCountMap.get(p.district_name) || 0;
      if (newCount !== (p.blog_count || 0)) {
        await (sb as any).from('redevelopment_projects')
          .update({ blog_count: newCount })
          .eq('id', p.id);
        blogUpdated++;
      }
    }

    // 3. 구역 내 실거래 평균가 (sigungu 기반 — 주 1회 수준)
    const sigunguSet = new Set<string>(projects.map((p: any) => `${p.region}|${p.sigungu}`).filter((s: string) => s.includes('|') && !s.endsWith('|null')));

    for (const key of Array.from(sigunguSet)) {
      const [region, sigungu] = key.split('|');
      if (!sigungu) continue;

      const { data: trades } = await sb.from('apt_transactions')
        .select('deal_amount')
        .eq('region_nm', region)
        .eq('sigungu', sigungu)
        .eq('trade_type', '매매')
        .gte('deal_date', new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10))
        .order('deal_date', { ascending: false })
        .limit(20);

      if (trades && trades.length >= 3) {
        const avg = Math.round(trades.reduce((s, t) => s + (t.deal_amount || 0), 0) / trades.length);
        const regionProjects = projects.filter((p: any) => p.region === region && p.sigungu === sigungu);
        for (const p of regionProjects) {
          await (sb as any).from('redevelopment_projects')
            .update({ avg_trade_price: avg, recent_trade_count: trades.length })
            .eq('id', p.id);
          tradeUpdated++;
        }
      }
    }

    // 4. 단계 변경 감지
    for (const p of projects) {
      if (p.previous_stage && p.previous_stage !== p.stage) {
        // 이미 감지된 변경 — 스킵
        continue;
      }
      // previous_stage가 없으면 현재 stage를 기록 (초기화)
      if (!p.previous_stage) {
        await (sb as any).from('redevelopment_projects')
          .update({ previous_stage: p.stage })
          .eq('id', p.id);
      }
    }

    updated = blogUpdated + tradeUpdated + stageChanged;

    return {
      processed: projects.length,
      created: 0,
      updated,
      failed: 0,
      metadata: { blogUpdated, tradeUpdated, stageChanged, sigunguChecked: sigunguSet.size },
    };
  });

  return NextResponse.json({ ok: true, ...result });
});
