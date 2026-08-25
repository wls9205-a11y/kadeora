export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { safeBlogInsert, extractAptSiteSlugs } from '@/lib/blog-safe-insert';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import { fitTitle } from '@/lib/blog/title-fit';

/**
 * ADDENDUM §4-4 — 이번 주 움직인 현장 (주간).
 *
 * 다섯 종류 중 **카더라만 만들 수 있는 글**이다. 청약홈·포털은 단계 이동 이력을 갖고 있지 않다.
 * apt_site_events 의 stage_change 를 주 단위로 묶어 현장으로 링크를 뿌린다.
 *
 * ── 재료 ──
 * get_weekly_stage_movers(p_region, p_days) → jsonb
 *   total(진짜 단계 이동) · newly_registered(신규 등록) · publishable(total>=3)
 *   confirmed · items[](from_stage → to_stage · builder · 세대수 · variants · source · note)
 *
 * ── ⚠️ 「신규 등록」과 「단계 이동」을 절대 섞지 않는다 ──
 *   DB 담당이 함수를 만들며 잡은 함정이다. 처음엔 부울경 375건이 나왔는데
 *   그중 341건이 부산 277건 승격 때 생긴 **첫 이력**이었다.
 *     from_value IS NULL   → 신규 등록
 *     from_value = to_value → 변경 아님
 *     source LIKE 'seed:%'  → 대량 시드
 *   이걸 빼야 실제 이동 34건이 남는다.
 *   섞어 쓰면 「이번 주 341곳이 움직였다」는 **거짓말**이 된다. 글에서도 문단을 가른다.
 *
 * ── ⚠️ publishable 이 false 인 주는 글을 내지 않는다 ──
 *   안 움직인 주가 있는 게 정상이다. 빈 글을 만들지 않는다.
 *
 * ── ⚠️ 주마다 새 글을 만들지 않는다 (§4-1 과 같은 이유) ──
 *   check_blog_similarity 가 시그니처 같은 발행글끼리 비교하는데, 주간 글은
 *   제목이 거의 같아 둘째 주부터 similar_title 로 막힌다.
 *   URL 하나를 고정하고 매주 본문을 갈아끼운다 — 「이번 주」 페이지는 원래 그 형태가 맞다.
 */

const CRON_TYPE = 'weekly-movers';

/** 기본 대상. 광고를 태우는 지역이다. */
const DEFAULT_REGION = '부울경';

/** 조회 기간(일). 주간이라 7일. */
const DEFAULT_DAYS = 7;

/** 본문에 실을 이동 건수 상한. */
const MAX_ITEMS = 25;

interface MoverItem {
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  from_stage: string | null;
  to_stage: string | null;
  stage: string | null;
  builder: string | null;
  supply_units: number | null;
  complex_units: number | null;
  confidence: string | null;
  source: string | null;
  note: string | null;
  variants: string[] | null;
  occurred_at: string | null;
}

interface Movers {
  total: number;
  newly_registered: number;
  confirmed: number;
  publishable: boolean;
  items: MoverItem[];
}

/** 앵커 회전. 같은 앵커 반복은 과최적화 신호다. 링크 대상은 항상 /apt/{slug}. */
function anchor(item: MoverItem, i: number): string {
  const pool = [item.name, ...(item.variants ?? [])].filter(
    (v): v is string => typeof v === 'string' && v.trim().length >= 3,
  );
  return pool.length === 0 ? item.slug : pool[i % pool.length];
}

/** ⚠️ 확정이 아니면 단정하지 않는다 (표시광고법). */
function unitsPhrase(item: MoverItem): string | null {
  const soft = item.confidence === 'confirmed' ? '' : ' 예정';
  if (item.complex_units && item.complex_units > 0) return `총 ${item.complex_units.toLocaleString('ko-KR')}세대${soft}`;
  if (item.supply_units && item.supply_units > 0) return `일반분양 ${item.supply_units.toLocaleString('ko-KR')}세대${soft}`;
  return null;
}

function builderPhrase(item: MoverItem): string | null {
  if (!item.builder) return null;
  return item.confidence === 'confirmed' ? item.builder : `${item.builder}(알려짐)`;
}

/** 등급 표기 — 감추지 않는다. 추정·카더라를 확정처럼 보이게 하지 않는다. */
function gradeMark(confidence: string | null): string {
  if (confidence === 'confirmed') return '';
  if (confidence === 'estimated') return ' [추정]';
  return ' [카더라]';
}

function buildBody(m: Movers, items: MoverItem[], region: string, label: string, days: number): string {
  const lines: string[] = [];

  lines.push(
    `${region}에서 최근 ${days}일 사이 진행 단계가 바뀐 현장 ${m.total}곳을 정리했습니다. (${label} 기준)`,
  );

  const byTo = new Map<string, number>();
  for (const it of items) {
    const to = lifecycleLabel(it.to_stage ?? it.stage) ?? '단계 변경';
    byTo.set(to, (byTo.get(to) ?? 0) + 1);
  }
  const dist = [...byTo.entries()].map(([k, v]) => `${k} ${v}곳`).join(' · ');
  if (dist) {
    lines.push('');
    lines.push(`이동한 단계는 ${dist} 입니다. 이 중 고시·공시 원문으로 확인된 건은 ${m.confirmed}곳입니다.`);
  }

  /* ── 계산된 사실로 본문을 채운다 (§4-1 과 같은 방식) ──
     ⚠️ 부울경 34곳이 1,968자로 min_content_length 2,000 에 **32자 차이**로 걸렸다.
        주간이라 매주 이 경계에 붙는다. 값은 주마다 달라 중복 콘텐츠가 되지 않는다. */
  const unitList = items.map((it) => it.complex_units ?? it.supply_units ?? 0).filter((n) => n > 0);
  if (unitList.length >= 2) {
    const sum = unitList.reduce((a, b) => a + b, 0);
    const biggest = items.find((it) => (it.complex_units ?? it.supply_units ?? 0) === Math.max(...unitList));
    lines.push('');
    lines.push(
      `세대수가 확인된 ${unitList.length}곳을 합치면 약 ${sum.toLocaleString('ko-KR')}세대 규모입니다. ` +
        `이 중 가장 큰 곳은 ${biggest?.name ?? '-'}입니다.`,
    );
  }

  const withBuilder = items.filter((it) => it.builder).length;
  const byArea = new Map<string, number>();
  for (const it of items) {
    const key = [it.region, it.sigungu].filter(Boolean).join(' ');
    if (key) byArea.set(key, (byArea.get(key) ?? 0) + 1);
  }
  const topArea = [...byArea.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topArea) {
    lines.push(
      `지역별로는 ${topArea[0]}가 ${topArea[1]}곳으로 가장 많고, 시공사가 확인된 현장은 ${withBuilder}곳입니다.`,
    );
  }

  lines.push('');
  lines.push(
    '단계가 바뀌었다는 것은 그 구역의 사업이 실제로 진척됐다는 뜻입니다. ' +
      '조합설립 · 사업시행인가 · 관리처분인가 · 착공 순으로 진행되며, 뒤 단계일수록 일반분양 시기가 가까워집니다. ' +
      '다만 단계 사이 간격은 구역마다 크게 달라 통상 수년이 걸립니다.',
  );

  lines.push('');
  lines.push('## 단계가 바뀐 현장');
  lines.push('');

  items.forEach((it, i) => {
    const from = lifecycleLabel(it.from_stage);
    const to = lifecycleLabel(it.to_stage ?? it.stage) ?? '단계 변경';
    const where = [it.region, it.sigungu].filter(Boolean).join(' ');
    const bits = [where, builderPhrase(it), unitsPhrase(it)].filter(Boolean);
    lines.push(
      `- [${anchor(it, i)}](/apt/${it.slug}) — ${from ? `${from} → ` : ''}${to}${gradeMark(it.confidence)}` +
        (bits.length > 0 ? `\n  ${bits.join(' · ')}` : ''),
    );
  });

  if (m.total > items.length) {
    lines.push('');
    lines.push(`그 밖에 ${m.total - items.length}곳이 더 있습니다.`);
  }

  /* ── ⚠️ 신규 등록은 **다른 문단**이다. 위 숫자와 합치지 않는다 ── */
  if (m.newly_registered > 0) {
    lines.push('');
    lines.push('## 이번 주 새로 등록된 현장');
    lines.push('');
    lines.push(
      `단계가 바뀐 것과는 별개로, 같은 기간 카더라에 새로 등록된 현장이 ${m.newly_registered.toLocaleString('ko-KR')}곳입니다. ` +
        `공공데이터·고시 자료를 수집해 처음 올린 것이라 “진행이 있었다”는 뜻은 아닙니다. ` +
        `[${region} 정비사업 전체 보기](/apt/pipeline)에서 확인하실 수 있습니다.`,
    );
  }

  lines.push('');
  lines.push(
    `단계 표기는 고시·공시 원문을 [확정], 복수 언론 보도를 [추정], 업계·조합 전언을 [카더라]로 구분했습니다. ` +
      `확정되지 않은 세대수·시공사에는 「예정」·「알려짐」을 붙였습니다.`,
  );

  return lines.join('\n');
}

/** ISO 주차 라벨. 제목이 주마다 달라지는 축이다. */
function weekLabel(kst: Date): { label: string; slugPart: string } {
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const week = Math.ceil(kst.getUTCDate() / 7);
  return { label: `${y}년 ${m}월 ${week}주`, slugPart: `${y}${String(m).padStart(2, '0')}w${week}` };
}

async function handler(req: NextRequest) {
  const result = await withCronLogging('blog-weekly-movers', async () => {
    const admin = getSupabaseAdmin() as any;

    const region = req.nextUrl.searchParams.get('region')?.trim() || DEFAULT_REGION;
    const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || DEFAULT_DAYS));

    const kst = new Date(Date.now() + 9 * 3600_000);
    const { label } = weekLabel(kst);

    const { data: raw, error } = await admin.rpc('get_weekly_stage_movers', {
      p_region: region,
      p_days: days,
    });
    if (error) throw new Error(`rpc: ${error.message}`);

    const m = raw as Movers | null;
    if (!m) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_data', region } };

    // ⚠️ 안 움직인 주가 있는 게 정상이다. 빈 글을 만들지 않는다.
    if (!m.publishable || (m.items ?? []).length === 0) {
      return {
        processed: m.total ?? 0,
        created: 0,
        failed: 0,
        metadata: {
          region, days, week: label,
          skipped: 'not_publishable',
          total: m.total ?? 0,
          newly_registered: m.newly_registered ?? 0,
        },
      };
    }

    const items = (m.items ?? []).slice(0, MAX_ITEMS);
    // ⚠️ 80자 게이트. 대표 단지명이 길어 3개를 다 넣으면 넘친다 — fitTitle 이 개수를 줄인다.
    const title = fitTitle(
      items.map((i) => i.name),
      (picked) =>
        picked.length > 0
          ? `${region} 이번 주 움직인 현장 — ${picked.join(', ')} 등 ${m.total}곳 (${label})`
          : `${region} 이번 주 움직인 현장 ${m.total}곳 (${label})`,
    );
    // ⚠️ slug 에 주차를 넣지 않는다. URL 하나를 고정하고 매주 갈아끼운다 (§4-1 과 같은 이유).
    const slug = `${region}-이번주-움직인-현장`.replace(/\s+/g, '-').toLowerCase();

    const content = buildBody(m, items, region, label, days);
    const excerpt = `${region}에서 최근 ${days}일 사이 진행 단계가 바뀐 현장 ${m.total}곳의 변경 내용과 등급을 정리했습니다.`;

    const { data: cfg } = await admin
      .from('blog_publish_config').select('min_content_length').eq('id', 1).maybeSingle();
    const minLen = Number(cfg?.min_content_length ?? 2000);

    const { data: existingPost } = await admin
      .from('blog_posts').select('id').eq('slug', slug).maybeSingle();

    if (existingPost) {
      // §2-2 게이트와 같은 규칙 — 현장 링크가 없으면 갱신하지 않는다.
      if (extractAptSiteSlugs(content).length === 0) {
        return { processed: m.total, created: 0, failed: 0, metadata: { region, week: label, skipped: 'no_site_link' } };
      }
      const { data: upd, error: updErr } = await admin
        .from('blog_posts')
        .update({ title, content, excerpt, updated_at: new Date().toISOString() })
        .eq('id', existingPost.id)
        .select('id');
      // ⚠️ 영향 행 수를 본다. 0건이면 갱신했다고 세지 않는다.
      const wrote = !updErr && (upd?.length ?? 0) > 0;
      return {
        processed: m.total,
        created: 0,
        failed: wrote ? 0 : 1,
        metadata: {
          region, days, week: label, refreshed: wrote ? 1 : 0,
          total: m.total, newly_registered: m.newly_registered, confirmed: m.confirmed,
          links: extractAptSiteSlugs(content).length,
          error: updErr?.message ?? null,
          title,
        },
      };
    }

    // 신규는 본문 길이를 미리 본다 — content_too_short 로 떨어지면 원인이 안 보인다.
    if (content.length < minLen) {
      return {
        processed: m.total, created: 0, failed: 0,
        metadata: { region, week: label, skipped: 'too_thin', chars: content.length, min: minLen },
      };
    }

    const res = await safeBlogInsert(admin, {
      slug, title, content, excerpt,
      category: 'apt',
      tags: [region, '재개발', '재건축', '정비사업', '주간'],
      source_type: 'auto',
      cron_type: CRON_TYPE,
      // hub_apt_slug 는 넘기지 않는다 — safeBlogInsert 가 리드폼 뜨는 현장을 우선해 고른다.
    });

    return {
      processed: m.total,
      created: res.success ? 1 : 0,
      failed: 0,
      metadata: {
        region, days, week: label,
        total: m.total, newly_registered: m.newly_registered, confirmed: m.confirmed,
        links: (res.siteSlugs ?? []).length,
        skipped_reason: res.success ? null : res.reason,
        // ⚠️ reason 만으로는 원인을 못 찾는다. safeBlogInsert 는 TITLE_TOO_LONG 같은
        //    품질 게이트 위반을 전부 duplicate_slug 로 뭉뚱그려 보고한다. 원문을 함께 낸다.
        skipped_message: res.success ? null : (res.message ?? null),
        title,
      },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
