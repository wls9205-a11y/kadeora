export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { safeBlogInsert, extractAptSiteSlugs } from '@/lib/blog-safe-insert';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';

/**
 * ADDENDUM §4-1 — 구·군별 정비사업 현황 (월간).
 *
 * ── 왜 이게 1번인가 ──
 * GSC 실측(2026-04-18~22)에서 현장 상세가 블로그보다 **26배 효율**이었다.
 *   블로그    노출 28,120 · 클릭 26 · CTR 0.09%
 *   현장 상세 노출  1,711 · 클릭 41 · CTR 2.4%
 * 목표는 "글을 더 쓰는 것"이 아니라 **현장 페이지로 링크를 흘려보내는 것**이다.
 * 이 글 한 편이 한 구의 현장 10~50곳으로 링크를 뿌린다.
 * 인바운드 0개 현장 4,178건을 줄이는 가장 효율 좋은 경로다.
 *
 * ── 재료 ──
 * get_district_redev_digest(region, sigungu) 가 전부 준다.
 *   total · rich · publishable · items[](단계순, 같은 단계면 세대수 큰 순)
 * ⚠️ **publishable 을 반드시 본다.** 88개 구 중 15개만 통과한다(현장 331곳).
 *    서울 중구는 total 18 인데 rich 0 이라 차단된다 — 면적변경 고시 소스라
 *    시공사·세대수가 전부 없다. total 만 보고 발행하면 「구역명 나열」 빈 글이 나간다.
 *
 * ── 지켜야 하는 것 3가지 ──
 * ① 앵커 회전. 같은 앵커 반복은 과최적화 신호다. items[].variants 를 돌려 쓴다.
 * ② confidence 가 estimated·rumor 면 단정하지 않는다. 「예정」·「알려짐」을 붙이거나 뺀다.
 *    표시광고법이라 문구가 아니라 규칙이다.
 * ③ 중복 콘텐츠 — **매월 새 글이 아니라 같은 글을 갱신한다.**
 *
 * ── ⚠️ ③ 을 새 글로 하면 둘째 달부터 조용히 멈춘다 (실측) ──
 *   check_blog_similarity 는 extract_complex_signature 가 같은 발행글끼리만 비교하는데,
 *     '부산 금정구 … (2026년 8월)' → 시그니처 `부산 금정구`
 *     '부산 금정구 … (2026년 9월)' → 시그니처 `부산 금정구`  · 유사도 **0.76**
 *   threshold 0.45 를 넘어 둘째 달 글이 similar_title 로 차단된다.
 *   첫 달만 성공하고 그 뒤로는 아무 일도 안 일어나는데 로그는 조용하다 —
 *   오늘 반복해서 본 그 실패 방식이다.
 *
 *   그래서 **구별 URL 하나를 고정하고 매월 본문을 갈아끼운다.**
 *   중복 콘텐츠 위험이 아예 사라지고, 한 URL 에 권위가 쌓이며, 최신성도 유지된다.
 *   제목의 월 표기와 상단 「이번 달 바뀐 구역」이 갱신 신호를 만든다.
 *
 * ── ⚠️ 같은 달 15개 구 제목이 서로 막지 않는 이유 ──
 *   제목에 대표 구역명 3개를 넣어 최대 유사도를 0.426 까지 낮췄다(실측, 임계 0.45).
 *   그냥 `{구} 재개발·재건축 {월} 진행 현황 {N}곳` 형태는 구끼리 **0.667** 이라 전부 막힌다.
 */

/** 이 크론이 만드는 글의 표식. 중복 판정·집계에 쓴다. */
const CRON_TYPE = 'district-redev-monthly';

/** 한 실행에서 만들 글 수 상한. 15구가 전부라 넉넉하지만 폭주는 막는다. */
const MAX_POSTS = 20;

/** 본문에 실을 현장 수 상한. 50개를 넘기면 글이 목록이 된다. */
const MAX_ITEMS = 40;

interface DigestItem {
  slug: string;
  name: string;
  raw_name: string | null;
  stage: string | null;
  builder: string | null;
  supply_units: number | null;
  complex_units: number | null;
  dong: string | null;
  has_image: boolean;
  confidence: string | null;
  variants: string[] | null;
}

interface Digest {
  region: string;
  sigungu: string;
  total: number;
  rich: number;
  publishable: boolean;
  items: DigestItem[];
}

/**
 * 앵커 텍스트. **같은 글 안에서 같은 문구를 반복하지 않는다.**
 * variants 를 인덱스로 돌려 쓰고, 없으면 name 으로 떨어진다.
 * ⚠️ 링크 대상은 항상 /apt/{slug} 다 — 앵커만 바뀐다.
 */
function anchor(item: DigestItem, i: number): string {
  const pool = [item.name, ...(item.variants ?? [])].filter(
    (v): v is string => typeof v === 'string' && v.trim().length >= 3,
  );
  if (pool.length === 0) return item.slug;
  return pool[i % pool.length];
}

/**
 * 세대수 서술.
 * ⚠️ confidence 가 confirmed 가 아니면 단정하지 않는다.
 *    complex_units(단지 전체)를 우선 쓰고, 없으면 supply_units 를 **이름 붙여** 쓴다 —
 *    라벨 없는 '176세대' 는 총세대수로 오독된다.
 */
function unitsPhrase(item: DigestItem): string | null {
  const confirmed = item.confidence === 'confirmed';
  const soft = confirmed ? '' : ' 예정';
  if (item.complex_units && item.complex_units > 0) {
    return `총 ${item.complex_units.toLocaleString('ko-KR')}세대${soft}`;
  }
  if (item.supply_units && item.supply_units > 0) {
    return `일반분양 ${item.supply_units.toLocaleString('ko-KR')}세대${soft}`;
  }
  return null;
}

/** 시공사 서술. 확정이 아니면 「알려짐」을 붙인다. */
function builderPhrase(item: DigestItem): string | null {
  if (!item.builder) return null;
  return item.confidence === 'confirmed' ? item.builder : `${item.builder}(알려짐)`;
}

/**
 * 단계 한 줄 설명.
 * ⚠️ 그 구에 **실제로 있는 단계만** 낸다. 전 구에 같은 문단을 깔면 15편이 서로
 *    중복 콘텐츠가 된다. 구마다 단계 구성이 달라 이 방식이면 자연히 갈린다.
 */
const STAGE_NOTE: Record<string, string> = {
  construction: '철거·착공에 들어간 구역입니다. 일반분양 시기가 가장 가깝습니다.',
  mgmt_approved: '관리처분인가를 받은 구역입니다. 조합원 분담금과 일반분양 물량이 확정되는 단계입니다.',
  plan_approved: '사업시행인가 단계입니다. 세대수·용적률 등 사업 규모가 정해집니다.',
  constructor_selected: '시공사를 선정한 구역입니다. 브랜드와 공사비가 정해지는 시점입니다.',
  union_established: '조합설립인가를 받은 구역입니다. 사업시행인가까지는 통상 수년이 걸립니다.',
  site_planning: '정비구역 지정·계획 단계입니다. 일정 변동 폭이 가장 큽니다.',
  pre_announcement: '모집공고를 앞둔 구역입니다.',
};

function buildBody(d: Digest, items: DigestItem[], movedSlugs: Set<string>, ym: string): string {
  const lines: string[] = [];

  lines.push(
    `${d.region} ${d.sigungu}에서 진행 중인 재개발·재건축 구역을 ${ym} 기준으로 정리했습니다. ` +
      `모집공고 전 단계까지 포함해 ${d.total}곳입니다.`,
  );

  /* ── 구 단위 요약 — 전부 계산된 사실이다. 구마다 값이 달라 중복이 되지 않는다 ── */
  const byStage = new Map<string, number>();
  for (const it of items) {
    const label = lifecycleLabel(it.stage) ?? '진행 중';
    byStage.set(label, (byStage.get(label) ?? 0) + 1);
  }
  const dist = [...byStage.entries()].map(([k, v]) => `${k} ${v}곳`).join(' · ');
  if (dist) {
    lines.push('');
    lines.push(`단계별로는 ${dist} 입니다.`);
  }

  const unitList = items
    .map((it) => it.complex_units ?? it.supply_units ?? 0)
    .filter((n) => n > 0);
  if (unitList.length >= 2) {
    const sum = unitList.reduce((a, b) => a + b, 0);
    const max = items
      .filter((it) => (it.complex_units ?? it.supply_units ?? 0) === Math.max(...unitList))[0];
    lines.push(
      `세대수가 확인된 ${unitList.length}곳을 합치면 약 ${sum.toLocaleString('ko-KR')}세대 규모이고, ` +
        `가장 큰 곳은 ${max?.raw_name || max?.name}입니다.`,
    );
  }

  const withBuilder = items.filter((it) => it.builder).length;
  if (withBuilder > 0) {
    lines.push(
      `시공사가 정해진 구역은 ${withBuilder}곳입니다. ` +
        `나머지는 아직 선정 전이거나 공개되지 않았습니다.`,
    );
  }

  if (movedSlugs.size > 0) {
    lines.push('');
    lines.push(`## 이번 달 단계가 바뀐 구역`);
    lines.push('');
    const moved = items.filter((it) => movedSlugs.has(it.slug));
    moved.forEach((it, i) => {
      const stage = lifecycleLabel(it.stage) ?? '진행 중';
      lines.push(`- [${anchor(it, i)}](/apt/${it.slug}) — ${stage}`);
    });
  }

  // 단계별로 묶는다. items 는 이미 단계순이라 순서를 유지하며 헤딩만 끼운다.
  lines.push('');
  lines.push(`## 구역별 진행 현황`);

  let lastStage: string | null = null;
  items.forEach((it, i) => {
    const stage = lifecycleLabel(it.stage) ?? '진행 중';
    if (stage !== lastStage) {
      lines.push('');
      lines.push(`### ${stage}`);
      lines.push('');
      const note = it.stage ? STAGE_NOTE[it.stage] : null;
      if (note) { lines.push(note); lines.push(''); }
      lastStage = stage;
    }
    const bits = [builderPhrase(it), unitsPhrase(it), it.dong].filter(Boolean);
    lines.push(`- [${anchor(it, i)}](/apt/${it.slug})${bits.length > 0 ? ` — ${bits.join(' · ')}` : ''}`);
  });

  if (d.total > items.length) {
    lines.push('');
    lines.push(
      `그 밖에 ${d.total - items.length}곳이 더 있습니다. ` +
        `[${d.region} 정비사업 전체 보기](/apt/redev/${encodeURIComponent(d.region)})`,
    );
  }

  lines.push('');
  lines.push(
    `단계와 세대수는 고시·공시 원문과 조합 공개 자료를 기준으로 하며, 확정되지 않은 항목은 「예정」·「알려짐」으로 표시했습니다. ` +
      `구역별 상세는 각 링크에서 확인하실 수 있습니다.`,
  );

  return lines.join('\n');
}

async function handler(_req: NextRequest) {
  const result = await withCronLogging('blog-district-redev', async () => {
    const admin = getSupabaseAdmin() as any;

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600_000);
    const year = kst.getUTCFullYear();
    const month = kst.getUTCMonth() + 1;
    const ym = `${year}년 ${month}월`;


    /* ── 대상 구 목록 ── */
    // 공고 전 현장이 있는 (region, sigungu) 만 본다. 88개를 전부 훑어도
    // 월 1회라 비용은 문제되지 않는다.
    const { data: pairs, error: pairErr } = await admin
      .from('apt_sites')
      .select('region, sigungu')
      .eq('is_active', true)
      .not('sigungu', 'is', null)
      .not('lifecycle_stage', 'in', '(post_move_in,landmark_active,move_in_started,move_in_ready)');
    if (pairErr) throw new Error(`pairs: ${pairErr.message}`);

    const seen = new Set<string>();
    const districts: { region: string; sigungu: string }[] = [];
    for (const p of pairs ?? []) {
      const key = `${p.region}|${p.sigungu}`;
      if (seen.has(key)) continue;
      seen.add(key);
      districts.push({ region: p.region, sigungu: p.sigungu });
    }

    /* ── 그달 단계가 바뀐 현장 (중복 콘텐츠 방지 + 최신성) ── */
    const since = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const { data: events } = await admin
      .from('apt_site_events')
      .select('site_slug')
      .eq('event_type', 'stage_change')
      .gte('occurred_at', since);
    const movedAll = new Set<string>((events ?? []).map((e: any) => e.site_slug).filter(Boolean));

    // ⚠️ 자동 보강(FAQ·계산기·출처)이 붙기 **전** 본문으로 미리 재기 때문에 보수적이다.
    //    보강분이 더 붙으므로 이 문턱을 넘으면 실제로는 여유가 있다.
    const { data: cfg } = await admin
      .from('blog_publish_config').select('min_content_length').eq('id', 1).maybeSingle();
    const minContentLength = Number(cfg?.min_content_length ?? 2000);

    let checked = 0;
    let skippedNotPublishable = 0;
    let created = 0;
    let refreshed = 0;
    const skippedReasons: Record<string, number> = {};
    const titles: string[] = [];
    const thinDistricts: string[] = [];

    for (const dst of districts) {
      if (created + refreshed >= MAX_POSTS) break;
      checked++;

      const { data: raw, error: digErr } = await admin.rpc('get_district_redev_digest', {
        p_region: dst.region,
        p_sigungu: dst.sigungu,
      });
      if (digErr) {
        skippedReasons[`rpc_error`] = (skippedReasons.rpc_error ?? 0) + 1;
        continue;
      }
      const d = raw as Digest | null;
      if (!d) continue;

      // ⚠️ 여기가 핵심 가드다. total 만 보고 발행하면 빈 글이 나간다.
      if (!d.publishable) { skippedNotPublishable++; continue; }

      const items = (d.items ?? []).slice(0, MAX_ITEMS);
      if (items.length === 0) { skippedNotPublishable++; continue; }

      const moved = new Set<string>(items.map((i) => i.slug).filter((s) => movedAll.has(s)));

      // ⚠️ 그달 바뀐 구역을 대표 3개의 앞자리에 세운다 —
      //    제목이 달마다 실제로 달라지고, 읽는 사람에게도 그게 새 정보다.
      const ordered = [...items].sort((a, b) => Number(moved.has(b.slug)) - Number(moved.has(a.slug)));
      const top3 = ordered.slice(0, 3).map((i) => i.raw_name || i.name).filter(Boolean).join(', ');

      // 제목: `{시·도} {구} 재개발 총정리` 를 앞에 둔다 — 유입 실증 패턴이 이 형태다.
      // 대표 구역명 3개가 구별 고유 트라이그램을 만들어 구끼리 차단되지 않게 한다(실측 0.426).
      const title = `${dst.region} ${dst.sigungu} 재개발 총정리 — ${top3} 등 ${d.total}곳 (${ym})`;

      // ⚠️ slug 에 월을 넣지 않는다. 구별 URL 하나를 고정하고 매월 갈아끼운다.
      const slug = `${dst.region}-${dst.sigungu}-정비사업-총정리`.replace(/\s+/g, '-').toLowerCase();

      const content = buildBody(d, items, moved, ym);
      const excerpt = `${dst.region} ${dst.sigungu} 재개발·재건축 ${d.total}곳의 ${ym} 기준 진행 단계와 시공사·세대수를 구역별로 정리했습니다.`;

      // ⚠️ 본문이 얇으면 여기서 멈춘다. safeBlogInsert 의 content_too_short 로 떨어지게 두면
      //    "왜 이 구만 안 나왔는지" 가 버그처럼 보인다. 실측: 부산 중구(5곳)가 유일하게 걸린다.
      //    현장이 적은 구는 링크가 적어 글로서도 얇다 — publishable 가드와 같은 취지로 여기서 끊는다.
      //    (하한을 올리려면 get_district_redev_digest 의 publishable 조건을 고쳐야 한다.)
      if (content.length < minContentLength) {
        thinDistricts.push(`${dst.region} ${dst.sigungu}(${items.length}곳·${content.length}자)`);
        skippedReasons.too_thin = (skippedReasons.too_thin ?? 0) + 1;
        continue;
      }

      /* ── 이미 있으면 갱신, 없으면 신규 ── */
      const { data: existingPost } = await admin
        .from('blog_posts').select('id, is_published').eq('slug', slug).maybeSingle();

      if (existingPost) {
        // §2-2 게이트와 같은 규칙을 여기서도 지킨다 — 현장 링크가 없으면 갱신하지 않는다.
        const linked = extractAptSiteSlugs(content);
        if (linked.length === 0) {
          skippedReasons.no_site_link = (skippedReasons.no_site_link ?? 0) + 1;
          continue;
        }
        const { data: upd, error: updErr } = await admin
          .from('blog_posts')
          .update({ title, content, excerpt, updated_at: new Date().toISOString() })
          .eq('id', existingPost.id)
          .select('id');
        // ⚠️ 영향 행 수를 확인한다. 0건이면 갱신했다고 세지 않는다.
        if (updErr || (upd?.length ?? 0) === 0) {
          skippedReasons.update_failed = (skippedReasons.update_failed ?? 0) + 1;
          continue;
        }
        refreshed++;
        titles.push(`(갱신) ${title}`);
        continue;
      }

      const res = await safeBlogInsert(admin, {
        slug,
        title,
        content,
        excerpt,
        category: 'apt',
        tags: [dst.region, dst.sigungu, '재개발', '재건축', '정비사업'],
        source_type: 'auto',
        cron_type: CRON_TYPE,
        // ⚠️ hub_apt_slug 는 넘기지 않는다. safeBlogInsert 가 본문 링크 중
        //    **리드폼이 뜨는 현장**을 우선해 고른다 (§2-2 후속). 여기서 지정하면 그 규칙을 우회한다.
      });

      if (res.success) {
        created++;
        titles.push(title);
      } else {
        skippedReasons[res.reason ?? 'unknown'] = (skippedReasons[res.reason ?? 'unknown'] ?? 0) + 1;
      }
    }

    return {
      processed: checked,
      created,
      failed: 0,
      metadata: {
        month: ym,
        districts_checked: checked,
        refreshed,
        skipped_not_publishable: skippedNotPublishable,
        thin_districts: thinDistricts,
        skipped_reasons: skippedReasons,
        moved_sites_this_month: movedAll.size,
        titles,
      },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
