export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface UnsoldStat {
  stat_month: string;
  region: string;
  total_unsold: number;
  after_completion: number;
  metadata: Record<string, any> | null;
}

const METRO_REGIONS = ['서울', '경기', '인천'] as const;

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function buildWarningBar(count: number, maxCount: number): string {
  const blocks = Math.min(Math.ceil((count / maxCount) * 10), 10);
  return '🟥'.repeat(blocks) + '⬜'.repeat(10 - blocks);
}

function buildContent(
  statMonth: string,
  stats: UnsoldStat[],
): string {
  const parts: string[] = [];

  // Aggregations
  const totalUnsold = stats.reduce((sum, s) => sum + (s.total_unsold || 0), 0);
  const totalAfterCompletion = stats.reduce((sum, s) => sum + (s.after_completion || 0), 0);
  const metroUnsold = stats
    .filter((s) => METRO_REGIONS.some((m) => s.region.startsWith(m)))
    .reduce((sum, s) => sum + (s.total_unsold || 0), 0);
  const localUnsold = totalUnsold - metroUnsold;

  // Format stat_month for display (e.g., "2025-09" → "2025년 9월")
  const [year, month] = statMonth.split('-');
  const displayMonth = `${year}년 ${parseInt(month, 10)}월`;

  parts.push(`## 전국 미분양 아파트 추이 — ${displayMonth}`);
  parts.push('');
  parts.push(`${displayMonth} 기준 전국 미분양 아파트 현황을 지역별로 분석합니다. 국토교통부 미분양 통계를 기반으로 핵심 지표와 위험 지역을 정리했습니다.`);
  parts.push('');

  // KPI
  parts.push('### 📊 핵심 지표');
  parts.push('');
  parts.push('| 항목 | 세대 수 |');
  parts.push('|---|---|');
  parts.push(`| 전국 미분양 | **${formatNumber(totalUnsold)}세대** |`);
  parts.push(`| 수도권 | **${formatNumber(metroUnsold)}세대** |`);
  parts.push(`| 지방 | **${formatNumber(localUnsold)}세대** |`);
  parts.push(`| 준공 후 미분양 | **${formatNumber(totalAfterCompletion)}세대** |`);
  parts.push('');

  const afterPct = totalUnsold > 0 ? ((totalAfterCompletion / totalUnsold) * 100).toFixed(1) : '0.0';
  parts.push(`전국 미분양 아파트는 총 **${formatNumber(totalUnsold)}세대**이며, 이 중 준공 후 미분양은 **${formatNumber(totalAfterCompletion)}세대**(${afterPct}%)입니다. 수도권은 ${formatNumber(metroUnsold)}세대, 지방은 ${formatNumber(localUnsold)}세대로 집계되었습니다.`);
  parts.push('');

  // Regional breakdown table
  const sorted = [...stats].sort((a, b) => (b.total_unsold || 0) - (a.total_unsold || 0));

  parts.push('### 📋 지역별 미분양 현황');
  parts.push('');
  parts.push('| 지역 | 미분양 | 준공후 | 비율 |');
  parts.push('|---|---|---|---|');
  for (const s of sorted) {
    const pct = s.total_unsold > 0
      ? ((s.after_completion / s.total_unsold) * 100).toFixed(1)
      : '0.0';
    parts.push(`| ${s.region} | ${formatNumber(s.total_unsold)}세대 | ${formatNumber(s.after_completion)}세대 | ${pct}% |`);
  }
  parts.push('');

  // Warning zones
  const maxUnsold = sorted[0]?.total_unsold || 1;
  const warningRegions = sorted.filter((s) => s.total_unsold >= 1000).slice(0, 10);

  if (warningRegions.length > 0) {
    parts.push('### ⚠️ 위험 지역 경고');
    parts.push('');
    parts.push('미분양 1,000세대 이상 지역을 경고 수준으로 표시합니다.');
    parts.push('');
    for (const r of warningRegions) {
      const bar = buildWarningBar(r.total_unsold, maxUnsold);
      parts.push(`**${r.region}**: ${bar} ${formatNumber(r.total_unsold)}세대`);
      parts.push('');
    }
  }

  // Analysis
  parts.push('### 🔍 분석');
  parts.push('');

  if (metroUnsold > localUnsold) {
    parts.push(`${displayMonth} 기준 수도권 미분양(${formatNumber(metroUnsold)}세대)이 지방(${formatNumber(localUnsold)}세대)보다 많은 것은 이례적인 상황입니다. 수도권 외곽 지역의 신규 분양 물량 증가가 원인으로 분석됩니다.`);
  } else {
    parts.push(`${displayMonth} 기준 지방 미분양(${formatNumber(localUnsold)}세대)이 수도권(${formatNumber(metroUnsold)}세대)보다 ${formatNumber(localUnsold - metroUnsold)}세대 더 많습니다. 지방 중소도시를 중심으로 미분양이 누적되고 있으며, 특히 준공 후 미분양 비율이 높은 지역은 사업성 악화 우려가 있습니다.`);
  }
  parts.push('');

  if (warningRegions.length > 0) {
    const topRegion = warningRegions[0];
    parts.push(`미분양이 가장 많은 지역은 **${topRegion.region}**(${formatNumber(topRegion.total_unsold)}세대)입니다. 미분양 집중 지역은 할인 분양, 중도금 무이자 등 혜택이 제공될 수 있으므로 실수요자에게는 기회가 될 수 있습니다. 다만, 향후 입주 물량과 지역 경기를 종합적으로 검토한 후 투자를 결정해야 합니다.`);
    parts.push('');
  }

  parts.push('미분양 아파트는 분양가 할인, 발코니 확장 무상, 추가 옵션 제공 등 다양한 혜택이 있을 수 있으나, 미분양 원인을 정확히 분석한 후 신중하게 접근하시기 바랍니다.');
  parts.push('');

  // Internal links
  parts.push('### 관련 정보');
  parts.push('');
  parts.push(`- [카더라 미분양 정보 →](${SITE_URL}/apt)`);
  parts.push(`- [부동산 블로그 →](${SITE_URL}/blog?category=apt)`);
  parts.push('');

  // Disclaimer
  parts.push('---');
  parts.push('');
  parts.push('> **면책고지**: 본 콘텐츠는 국토교통부 미분양 주택 통계를 기반으로 정보 제공 목적으로 작성되었으며, 특정 부동산의 매수를 권유하지 않습니다. 미분양 통계는 집계 시점에 따라 변동이 있을 수 있으므로 최신 데이터는 국토교통부 또는 해당 지자체를 통해 확인하시기 바랍니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.');

  return parts.join('\n');
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const offset = parseInt(params.get('offset') || '0', 10);
  const limit = parseInt(params.get('limit') || '4', 10);

  const admin = getSupabaseAdmin();

  // 1. Get the 4 most recent distinct stat_months
  const { data: monthsData, error: monthsErr } = await admin
    .from('unsold_monthly_stats')
    .select('stat_month')
    .order('stat_month', { ascending: false });

  if (monthsErr) {
    console.error('[blog-unsold-trend] months fetch error:', monthsErr.message);
    return NextResponse.json({ ok: false, error: monthsErr.message });
  }

  const distinctMonths = [...new Set((monthsData || []).map((r: any) => r.stat_month))].slice(0, 20);
  const targetMonths = distinctMonths.slice(offset, offset + limit);

  if (targetMonths.length === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: 0, total: 0, reason: 'no_data' });
  }

  let created = 0;
  let skipped = 0;

  for (const statMonth of targetMonths) {
    try {
      const slug = `unsold-trend-${statMonth}`;

      // Fetch stats for this month
      const { data: stats, error: statsErr } = await admin
        .from('unsold_monthly_stats')
        .select('stat_month, region, total_unsold, after_completion, metadata')
        .eq('stat_month', statMonth);

      if (statsErr || !stats || stats.length === 0) {
        skipped++;
        continue;
      }

      const unsoldStats = stats as UnsoldStat[];

      const [year, month] = statMonth.split('-');
      const quarter = Math.ceil(parseInt(month, 10) / 3);
      const displayLabel = `${year}년 ${parseInt(month, 10)}월`;

      const title = `전국 미분양 아파트 추이 ${displayLabel} — 지역별 증감과 할인 분양 기회`;

      let content = buildContent(statMonth, unsoldStats);
      content = ensureMinLength(content, 'unsold', 1500);

      const totalUnsold = unsoldStats.reduce((sum, s) => sum + (s.total_unsold || 0), 0);
      const tags = ['미분양', '아파트', '부동산', statMonth, `${year}년`, '할인분양', '준공후미분양'];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content,
        excerpt: `${displayLabel} 전국 미분양 아파트 현황 — 총 ${formatNumber(totalUnsold)}세대. 지역별 미분양 추이와 위험 지역 분석.`,
        category: 'apt',
        tags,
        source_type: 'auto',
        cron_type: 'blog-unsold-trend',
        data_date: statMonth,
        source_ref: 'unsold_monthly_stats',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&design=2&type=blog`,
        image_alt: generateImageAlt('unsold', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('unsold', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[blog-unsold-trend] Error for ${statMonth}:`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: distinctMonths.length,
  });
});
