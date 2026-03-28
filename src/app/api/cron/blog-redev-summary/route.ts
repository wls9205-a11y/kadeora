export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  TYPE 3 — 재개발 사업 추진 현황 요약 (5 posts)                       */
/* ------------------------------------------------------------------ */

interface RedevZone {
  id: number;
  region: string;
  district: string;
  zone_name: string;
  zone_type: string;
  original_complex: string;
  zone_area_m2: number;
  existing_units: number;
  planned_units: number;
  progress_stage: string;
  expected_completion: string;
  contractors: string;
  estimated_contribution: string;
  investment_point: string;
  nearby_station: string;
  tags: string[];
  description: string;
}

const STAGE_ORDER = ['기본계획', '정비구역지정', '조합설립', '사업시행인가', '관리처분인가', '착공'] as const;

const TARGETS: { region: string; label: string; slugKey: string }[] = [
  { region: 'all', label: '전국', slugKey: 'all' },
  { region: '서울', label: '서울', slugKey: 'seoul' },
  { region: '부산', label: '부산', slugKey: 'busan' },
  { region: '경기', label: '경기', slugKey: 'gyeonggi' },
  { region: '인천', label: '인천', slugKey: 'incheon' },
];

function buildContent(label: string, zones: RedevZone[]): string {
  const totalZones = zones.length;
  const totalPlanned = zones.reduce((s, z) => s + (z.planned_units || 0), 0);
  const avgArea = totalZones
    ? Math.round(zones.reduce((s, z) => s + (z.zone_area_m2 || 0), 0) / totalZones)
    : 0;

  /* 6-stage progress counts */
  const stageCounts: Record<string, number> = {};
  for (const st of STAGE_ORDER) stageCounts[st] = 0;
  for (const z of zones) {
    const matched = STAGE_ORDER.find((s) => (z.progress_stage || '').includes(s));
    if (matched) stageCounts[matched]++;
  }

  /* zone table rows */
  const zoneRows = zones
    .map(
      (z) =>
        `| ${z.zone_name} | ${z.district || ''} | ${z.progress_stage || ''} | ${(z.planned_units || 0).toLocaleString()} | ${z.expected_completion || '-'} |`,
    )
    .join('\n');

  /* investment points */
  const investPoints = zones
    .filter((z) => z.investment_point)
    .slice(0, 5)
    .map((z) => `- **${z.zone_name}**: ${z.investment_point}`)
    .join('\n');

  return `## ${label} 재개발 사업 KPI 요약

| 지표 | 수치 |
|------|------|
| **총 구역수** | ${totalZones}개 |
| **계획 세대수** | ${totalPlanned.toLocaleString()}세대 |
| **평균 면적** | ${avgArea.toLocaleString()}m2 |

2026년 현재 ${label} 지역에서 총 ${totalZones}개의 재개발 구역이 추진 중이며, 완료 시 ${totalPlanned.toLocaleString()}세대의 새로운 주거공간이 공급될 예정입니다.

## 단계별 진행 현황

재개발 사업은 기본계획부터 착공까지 6단계로 나뉩니다. 아래 표는 ${label} 전체 구역의 단계별 분포입니다.

| 단계 | 구역 수 | 비율 |
|------|---------|------|
${STAGE_ORDER.map((st) => {
  const cnt = stageCounts[st];
  const pct = totalZones ? ((cnt / totalZones) * 100).toFixed(1) : '0.0';
  return `| ${st} | ${cnt}개 | ${pct}% |`;
}).join('\n')}

${stageCounts['착공'] > 0 ? `현재 ${stageCounts['착공']}개 구역이 착공 단계에 진입하여 가장 빠른 입주가 예상됩니다.` : ''}
${stageCounts['관리처분인가'] > 0 ? `관리처분인가를 받은 ${stageCounts['관리처분인가']}개 구역은 이주 및 철거 준비 단계입니다.` : ''}
${stageCounts['조합설립'] > 0 ? `조합설립 단계의 ${stageCounts['조합설립']}개 구역은 사업시행인가를 앞두고 있습니다.` : ''}

## 구역별 상세 현황

| 구역명 | 자치구 | 진행단계 | 계획세대 | 예상완공 |
|--------|--------|----------|----------|----------|
${zoneRows || '| (해당 지역 데이터 없음) | - | - | - | - |'}

위 표는 ${label} 재개발 구역의 진행 현황을 정리한 것입니다. 각 구역의 진행단계와 계획세대수를 비교하여 관심 구역의 사업 속도를 확인하실 수 있습니다.

## 투자 포인트 분석

${label} 지역의 재개발 사업에서 주목할 만한 투자 포인트를 정리합니다.

${investPoints || '- 현재 등록된 투자 포인트 정보가 없습니다. 개별 구역의 입지, 시공사, 분양가 등을 종합적으로 분석하시기 바랍니다.'}

재개발 투자 시에는 사업 진행 단계, 예상 분담금, 시공사 브랜드, 주변 시세 대비 분양가 수준을 함께 고려해야 합니다. 특히 관리처분인가 이후 단계의 구역은 사업 확정성이 높아 상대적으로 안정적인 투자처로 평가됩니다.

## 관련 정보 더보기

- [전국 아파트 청약 일정 보기](${SITE_URL}/apt)
- [아파트 관련 블로그 글 모아보기](${SITE_URL}/blog?category=apt)

---

> **면책고지**: 본 콘텐츠는 공공 데이터를 기반으로 정보 제공 목적으로 작성되었으며, 특정 정비사업 투자를 권유하지 않습니다. 사업 진행 상황과 분담금은 변동될 수 있으며, 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`;
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = parseInt(url.searchParams.get('limit') || '5', 10);

  const admin = getSupabaseAdmin();
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const targets = TARGETS.slice(offset, offset + limit);

  for (const t of targets) {
    const slug = `redev-summary-${t.slugKey}-2026-03`;
    const title = `${t.label} 재개발 사업 추진 현황 2026 \u2014 단계별 진행률과 입주 예정 시기`;

    try {
      /* fetch zones */
      let query = admin
        .from('redevelopment_zones')
        .select('id, region, district, zone_name, zone_type, original_complex, zone_area_m2, existing_units, planned_units, progress_stage, expected_completion, contractors, estimated_contribution, investment_point, nearby_station, tags, description');

      if (t.region !== 'all') {
        query = query.eq('region', t.region);
      }

      const { data: zones, error: fetchErr } = await query;
      if (fetchErr) {
        console.error(`[blog-redev-summary] fetch error (${t.slugKey}):`, fetchErr.message);
        failed.push(slug);
        continue;
      }

      const zoneList = (zones || []) as RedevZone[];
      if (zoneList.length === 0 && t.region !== 'all') {
        skipped.push(slug);
        continue;
      }

      const content = buildContent(t.label, zoneList);
      const tags = ['재개발', '정비사업', t.label, '2026'];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content: ensureMinLength(content, 'apt'),
        excerpt: `${t.label} 재개발 구역 ${zoneList.length}곳의 단계별 진행 현황과 투자 포인트를 정리합니다.`,
        category: 'apt',
        tags,
        cron_type: 'redev-summary',
        is_published: true,
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
        image_alt: generateImageAlt('apt', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', tags),
      });

      if (result.success) {
        created.push(slug);
      } else {
        console.warn(`[blog-redev-summary] skip ${slug}: ${result.reason}`);
        skipped.push(slug);
      }
    } catch (e: any) {
      console.error(`[blog-redev-summary] error (${slug}):`, e.message);
      failed.push(slug);
    }
  }

  return NextResponse.json({ ok: true, created, skipped, failed });
});
