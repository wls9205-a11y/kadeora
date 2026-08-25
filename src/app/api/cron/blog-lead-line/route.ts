export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { safeBlogInsert, extractAptSiteSlugs } from '@/lib/blog-safe-insert';
import { recordSiteLinks } from '@/lib/blog/site-links';
import { rotateAnchor } from '@/lib/blog/anchor';
import { fitTitle } from '@/lib/blog/title-fit';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';

/**
 * ADDENDUM §G(⑥) — 이번 주 청약·미분양 (주간).
 *
 * ── 왜 이게 필요한가 ──
 * 「분양 라인 소외」. 실측 **846건이 인바운드 0개**다.
 * 청약·미분양·입주예정이 **리드가 실제로 나오는 현장**인데 링크를 못 받고 있었다.
 * §4-1(구·군별 정비사업)은 재개발·재건축을 덮지만 분양 라인은 안 덮는다.
 *
 * ── 재료 ──
 * get_backlink_targets(p_region, p_limit) → { region, items[] }
 *   정렬 2축: ① inbound ASC (blog_site_links 기준 — hub 아님)
 *             ② lead_priority ASC (리드가 나오는 순서)
 *                청약접수 0 · 미분양 1 · 당첨발표 2 · 계약 3 · 입주예정 4 · 분양예고 5
 *                착공 6 · 관리처분 7 · 사업시행 8 · 시공사선정 9 · 조합설립 10 · 부지계획 11
 *   게이트 내장 — 정보 2개 이상(시공사·세대수·이미지·시군구)인 현장만 나온다.
 *
 * ── ⚠️ publishable 플래그가 없다 ──
 * 이 함수는 items 만 준다. **여기서 하한을 둔다** — 대상이 적으면 글을 내지 않는다.
 *
 * ── ⚠️ 앵커 ──
 * variants 에 `부산`·`푸르지오` 같은 광범위 토큰이 섞여 있다. 그대로 쓰면
 * 브랜드·지역 일반 검색어에 엉뚱한 현장이 매달린다. lib/blog/anchor.ts 가 거른다.
 *
 * ── ⚠️ URL 고정 + 갱신 ──
 * §4-1·§4-4 와 같은 similar_title 함정. 주마다 새 글을 만들지 않는다.
 */

const CRON_TYPE = 'lead-line-weekly';

/** 광고를 태우는 지역이 먼저다. 전국은 그 다음. */
const DEFAULT_REGIONS = ['부울경', '전국'];

/** 한 글에 실을 현장 수. 40을 넘기면 글이 표가 된다. */
const MAX_ITEMS = 30;

/** 이보다 적으면 글을 내지 않는다. 빈 목록을 만들지 않는다. */
const MIN_ITEMS = 5;

/** ⚠️ 분양 라인만 — lead_priority 5 이하. 6+ 는 §4-1 이 이미 덮는 정비사업이다. */
const MAX_LEAD_PRIORITY = 5;

interface Target {
  slug: string;
  name: string;
  raw_name: string | null;
  region: string | null;
  sigungu: string | null;
  stage: string | null;
  builder: string | null;
  supply_units: number | null;
  complex_units: number | null;
  has_image: boolean;
  confidence: string | null;
  variants: unknown;
  inbound: number;
  lead_priority: number;
}

/** 섹션 — lead_priority 를 사람이 읽는 묶음으로. 순서가 곧 리드 우선순위다. */
const SECTIONS: { key: string; title: string; note: string; stages: string[] }[] = [
  {
    key: 'open',
    title: '청약 접수 중·임박',
    note: '접수 일정이 잡혀 있는 단지입니다. 자격 요건은 모집공고 원문에서 확인하세요.',
    stages: ['subscription_open', 'pre_announcement', 'award_announced', 'contract_signing'],
  },
  {
    key: 'unsold',
    title: '미분양·잔여세대',
    note: '분양이 끝났지만 잔여 세대가 남아 선착순 계약이 가능한 단지입니다. 조건이 수시로 바뀝니다.',
    stages: ['unsold_active'],
  },
  {
    key: 'movein',
    title: '입주 예정',
    note: '계약이 끝나고 입주를 앞둔 단지입니다. 잔여 물량이나 분양권 거래가 있을 수 있습니다.',
    stages: ['move_in_ready', 'move_in_started'],
  },
];

/** ⚠️ 확정이 아니면 단정하지 않는다 (표시광고법). */
function unitsPhrase(t: Target): string | null {
  const soft = t.confidence === 'confirmed' ? '' : ' 예정';
  if (t.complex_units && t.complex_units > 0) return `총 ${t.complex_units.toLocaleString('ko-KR')}세대${soft}`;
  if (t.supply_units && t.supply_units > 0) return `일반분양 ${t.supply_units.toLocaleString('ko-KR')}세대${soft}`;
  return null;
}

function builderPhrase(t: Target): string | null {
  if (!t.builder) return null;
  return t.confidence === 'confirmed' ? t.builder : `${t.builder}(알려짐)`;
}

function buildBody(region: string, items: Target[], label: string): string {
  const lines: string[] = [];
  const scope = region === '전국' ? '전국' : region;

  lines.push(
    `${scope}에서 지금 청약·계약이 가능하거나 곧 일정이 잡히는 단지를 ${label} 기준으로 정리했습니다. ` +
      `모두 ${items.length}곳입니다.`,
  );

  /* ── 계산된 사실로 본문을 채운다 (§4-1 과 같은 방식) ── */
  const unitList = items.map((t) => t.complex_units ?? t.supply_units ?? 0).filter((n) => n > 0);
  if (unitList.length >= 2) {
    const sum = unitList.reduce((a, b) => a + b, 0);
    const biggest = items.find((t) => (t.complex_units ?? t.supply_units ?? 0) === Math.max(...unitList));
    lines.push('');
    lines.push(
      `세대수가 확인된 ${unitList.length}곳을 합치면 약 ${sum.toLocaleString('ko-KR')}세대 규모이고, ` +
        `가장 큰 곳은 ${biggest?.raw_name || biggest?.name}입니다.`,
    );
  }

  const byArea = new Map<string, number>();
  for (const t of items) {
    const k = [t.region, t.sigungu].filter(Boolean).join(' ');
    if (k) byArea.set(k, (byArea.get(k) ?? 0) + 1);
  }
  const top = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length > 0) {
    lines.push(
      `지역별로는 ${top.map(([k, v]) => `${k} ${v}곳`).join(' · ')} 순으로 많습니다.`,
    );
  }

  let idx = 0;
  for (const sec of SECTIONS) {
    const rows = items.filter((t) => t.stage && sec.stages.includes(t.stage));
    if (rows.length === 0) continue;

    lines.push('');
    lines.push(`## ${sec.title} ${rows.length}곳`);
    lines.push('');
    lines.push(sec.note);
    lines.push('');

    for (const t of rows) {
      const stage = lifecycleLabel(t.stage) ?? '진행 중';
      const where = [t.region, t.sigungu].filter(Boolean).join(' ');
      const bits = [stage, where, builderPhrase(t), unitsPhrase(t)].filter(Boolean);
      lines.push(`- [${rotateAnchor(t.name, t.variants, idx++)}](/apt/${t.slug}) — ${bits.join(' · ')}`);
    }
  }

  // 위 섹션에 안 담긴 것(분양 예고 등)은 마지막에 모은다. 빠뜨리지 않는다.
  const covered = new Set(SECTIONS.flatMap((s) => s.stages));
  const rest = items.filter((t) => !t.stage || !covered.has(t.stage));
  if (rest.length > 0) {
    lines.push('');
    lines.push(`## 분양 예정 ${rest.length}곳`);
    lines.push('');
    lines.push('아직 모집공고 전이라 **접수 일정이 정해지지 않았습니다.** 사업 단계와 규모만 확인된 상태입니다.');
    lines.push('');
    for (const t of rest) {
      const where = [t.region, t.sigungu].filter(Boolean).join(' ');
      const bits = [lifecycleLabel(t.stage) ?? '진행 중', where, builderPhrase(t), unitsPhrase(t)].filter(Boolean);
      lines.push(`- [${rotateAnchor(t.name, t.variants, idx++)}](/apt/${t.slug}) — ${bits.join(' · ')}`);
    }
  }

  lines.push('');
  lines.push(
    `일정과 공급 세대수는 모집공고·공공데이터 기준이며 변경될 수 있습니다. ` +
      `확정되지 않은 항목은 「예정」·「알려짐」으로 표시했습니다. ` +
      `청약 자격과 최종 일정은 반드시 모집공고 원문에서 확인하시기 바랍니다.`,
  );

  return lines.join('\n');
}

function weekLabel(kst: Date): string {
  const week = Math.ceil(kst.getUTCDate() / 7);
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${week}주`;
}

async function handler(req: NextRequest) {
  const result = await withCronLogging('blog-lead-line', async () => {
    const admin = getSupabaseAdmin() as any;

    const one = req.nextUrl.searchParams.get('region')?.trim();
    const regions = one ? [one] : DEFAULT_REGIONS;
    const label = weekLabel(new Date(Date.now() + 9 * 3600_000));

    const { data: cfg } = await admin
      .from('blog_publish_config').select('min_content_length').eq('id', 1).maybeSingle();
    const minLen = Number(cfg?.min_content_length ?? 2000);

    let created = 0;
    let refreshed = 0;
    const skipped: Record<string, number> = {};
    const details: any[] = [];

    for (const region of regions) {
      // 상한을 넉넉히 받아 분양 라인만 걸러낸다 — 함수는 정비사업까지 함께 준다.
      const { data: raw, error } = await admin.rpc('get_backlink_targets', {
        p_region: region,
        p_limit: MAX_ITEMS * 3,
      });
      if (error) { skipped.rpc_error = (skipped.rpc_error ?? 0) + 1; continue; }

      const all = ((raw?.items ?? []) as Target[]).filter((t) => t && t.slug && t.name);
      // ⚠️ 분양 라인만. 6+ 는 §4-1 구·군별 정비사업이 이미 덮는다 —
      //    같은 현장에 두 글이 붙으면 자기잠식이다.
      const items = all.filter((t) => Number(t.lead_priority) <= MAX_LEAD_PRIORITY).slice(0, MAX_ITEMS);

      if (items.length < MIN_ITEMS) {
        skipped.too_few = (skipped.too_few ?? 0) + 1;
        details.push({ region, skipped: 'too_few', got: items.length, min: MIN_ITEMS, from_rpc: all.length });
        continue;
      }

      const title = fitTitle(
        items.map((t) => t.raw_name || t.name),
        (picked) =>
          picked.length > 0
            ? `${region} 청약·미분양 총정리 — ${picked.join(', ')} 등 ${items.length}곳 (${label})`
            : `${region} 청약·미분양 총정리 ${items.length}곳 (${label})`,
      );
      // ⚠️ slug 에 주차를 넣지 않는다. 지역별 URL 하나를 고정하고 갈아끼운다.
      const slug = `${region}-청약-미분양-총정리`.replace(/\s+/g, '-').toLowerCase();

      const content = buildBody(region, items, label);
      const excerpt =
        `${region}에서 청약 접수 중이거나 잔여 세대가 남은 단지, 입주를 앞둔 단지 ${items.length}곳의 단계·시공사·세대수를 정리했습니다.`;

      const { data: existingPost } = await admin
        .from('blog_posts').select('id').eq('slug', slug).maybeSingle();

      if (existingPost) {
        if (extractAptSiteSlugs(content).length === 0) {
          skipped.no_site_link = (skipped.no_site_link ?? 0) + 1;
          continue;
        }
        const { data: upd, error: updErr } = await admin
          .from('blog_posts')
          .update({ title, content, excerpt, updated_at: new Date().toISOString() })
          .eq('id', existingPost.id)
          .select('id');
        // ⚠️ 영향 행 수를 본다. 0건이면 갱신했다고 세지 않는다.
        if (updErr || (upd?.length ?? 0) === 0) {
          skipped.update_failed = (skipped.update_failed ?? 0) + 1;
          details.push({ region, skipped: 'update_failed', error: updErr?.message ?? 'no_row' });
          continue;
        }
        // §G-1: 갱신분도 링크 대장에 적는다.
        await recordSiteLinks(admin, existingPost.id, content);
        refreshed++;
        details.push({ region, refreshed: true, items: items.length, links: extractAptSiteSlugs(content).length, title });
        continue;
      }

      if (content.length < minLen) {
        skipped.too_thin = (skipped.too_thin ?? 0) + 1;
        details.push({ region, skipped: 'too_thin', chars: content.length, min: minLen });
        continue;
      }

      const res = await safeBlogInsert(admin, {
        slug, title, content, excerpt,
        category: 'apt',
        tags: [region, '청약', '미분양', '분양', '잔여세대'],
        source_type: 'auto',
        cron_type: CRON_TYPE,
      });

      if (res.success) {
        created++;
        details.push({ region, created: true, items: items.length, links: (res.siteSlugs ?? []).length, title });
      } else {
        skipped[res.reason ?? 'unknown'] = (skipped[res.reason ?? 'unknown'] ?? 0) + 1;
        // ⚠️ reason 만으로는 원인을 못 찾는다 — TITLE_TOO_LONG 이 duplicate_slug 로 뭉개진 전례가 있다.
        details.push({ region, skipped: res.reason, message: res.message ?? null });
      }
    }

    return {
      processed: regions.length,
      created,
      failed: 0,
      metadata: { regions, refreshed, skipped, details },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
