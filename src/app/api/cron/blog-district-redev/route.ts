export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { safeBlogInsert, extractAptSiteSlugs } from '@/lib/blog-safe-insert';
import { recordSiteLinks } from '@/lib/blog/site-links';
import {
  buildBody,
  decideSplit,
  pickRepresentatives,
  type Digest,
  type DigestItem,
} from '@/lib/blog/district-body';

/**
 * ADDENDUM §4-1 — 구·군별 정비사업 현황 (월간).
 *
 * ── 왜 이게 1번인가 ──
 * GSC 실측(2026-04-18~22)에서 현장 상세가 블로그보다 **26배 효율**이었다.
 *   블로그    노출 28,120 · 클릭 26 · CTR 0.09%
 *   현장 상세 노출  1,711 · 클릭 41 · CTR 2.4%
 * 목표는 "글을 더 쓰는 것"이 아니라 **현장 페이지로 링크를 흘려보내는 것**이다.
 * 이 글 한 편이 한 구의 현장 10~50곳으로 링크를 뿌린다.
 *
 * ⚠️ 「인바운드 0개 4,178건」은 **틀린 숫자였다**(§G-1). hub_apt_slug 만 세면
 *    글당 대표 1개뿐이라 본문 링크를 못 센다. blog_site_links 전체 백필 후 실측:
 *    링크 5,271 · 커버 현장 855 · hub 합집합 기준 **인바운드 0개 = 3,809 / 6,049**.
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

/**
 * 한 현장이 「정보 2개 이상」 게이트를 통과하는가.
 *
 * ⚠️ digest 의 `rich` 는 **구 전체 기준**이다. 재건축만 떼면 그 부분집합으로 다시 세야 한다 —
 *    안 그러면 재건축 5건 중 정보가 하나도 없는 구가 통과해 빈 글이 나간다.
 * ⚠️ builder 가 빈 문자열('')로 오는 경우가 있다(실측). 존재 여부로 세지 말 것.
 */
function richCount(items: DigestItem[]): number {
  return items.filter((it) => {
    let n = 0;
    if (it.builder && it.builder.trim()) n++;
    if ((it.complex_units ?? 0) > 0 || (it.supply_units ?? 0) > 0) n++;
    if (it.has_image) n++;
    if (it.dong && it.dong.trim()) n++;
    return n >= 2;
  }).length;
}

/** 부분집합이 글이 될 만한가. digest 의 publishable 과 같은 기준(total>=5 AND rich>=2). */
function subsetPublishable(items: DigestItem[]): boolean {
  return items.length >= 5 && richCount(items) >= 2;
}

/** 제목에 쓸 유형 라벨. 모르면 「정비사업」으로 떨어진다 — 지어내지 않는다. */
function typeLabel(t: string | null | undefined): string {
  const v = (t ?? '').trim();
  return v === '재개발' || v === '재건축' ? v : '정비사업';
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
    // ⚠️ reason 만으로는 원인을 못 찾는다. 원문을 함께 남긴다.
    const skippedMessages: string[] = [];

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

      const all = (d.items ?? []).slice(0, MAX_ITEMS);
      if (all.length === 0) { skippedNotPublishable++; continue; }

      /* ── 재건축 분리 ──
       *
       * ⚠️ 두 글이 **겹치면 안 된다.** 자기잠식이기도 하고, 제목 중복으로 둘째 글이 막히기도 한다.
       *    실측: 본편이 재건축을 앞에 세우고 있어 대표 3곳이 같아지고,
       *          「해운대구 재건축 총정리 — 재송2 재건축, 반여4 재건축…」 이
       *          기존 본편과 **유사도 0.81** 로 차단됐다(임계 0.4).
       *    본편에서 재건축을 빼면 대표 3곳이 저절로 달라져 두 문제가 같이 풀린다.
       *
       *   본편  = 재개발 + 가로주택정비 + 기타
       *   분리편 = 재건축만
       *
       * ⚠️ 분리는 **양쪽이 다 글이 될 때만** 한다. 판단은 decideSplit 안에 있다 —
       *    첫 실행에서 too_thin 14건을 낸 게 정확히 이 결정이라 테스트로 잠가 뒀다.
       */
      const dec = decideSplit(d, all, ym, movedAll, minContentLength);
      const { split, mainItems, rebuildItems } = dec;
      if (dec.revertedMessage) {
        skippedReasons.split_reverted = (skippedReasons.split_reverted ?? 0) + 1;
        skippedMessages.push(dec.revertedMessage);
      }

      /** 한 편을 내보낸다. 신규는 insert, 있으면 갱신. */
      const emit = async (
        kind: string,
        pSlug: string,
        pTitle: string,
        pItems: DigestItem[],
        pExcerpt: string,
        pTags: string[],
      ) => {
        const movedSet = new Set<string>(pItems.map((i) => i.slug).filter((s) => movedAll.has(s)));
        const body = buildBody({ ...d, total: pItems.length }, pItems, movedSet, ym);

        // ⚠️ 본문이 얇으면 여기서 멈춘다. safeBlogInsert 의 content_too_short 로 떨어지게 두면
        //    "왜 이것만 안 나왔는지" 가 버그처럼 보인다.
        if (body.length < minContentLength) {
          thinDistricts.push(`${dst.region} ${dst.sigungu}/${kind}(${pItems.length}곳·${body.length}자)`);
          skippedReasons.too_thin = (skippedReasons.too_thin ?? 0) + 1;
          return;
        }

        const { data: existingPost } = await admin
          .from('blog_posts').select('id').eq('slug', pSlug).maybeSingle();

        if (existingPost) {
          // §2-2 게이트와 같은 규칙 — 현장 링크가 없으면 갱신하지 않는다.
          if (extractAptSiteSlugs(body).length === 0) {
            skippedReasons.no_site_link = (skippedReasons.no_site_link ?? 0) + 1;
            return;
          }
          const { data: upd, error: updErr } = await admin
            .from('blog_posts')
            .update({ title: pTitle, content: body, excerpt: pExcerpt, updated_at: new Date().toISOString() })
            .eq('id', existingPost.id)
            .select('id');
          // ⚠️ 영향 행 수를 확인한다. 0건이면 갱신했다고 세지 않는다.
          if (updErr || (upd?.length ?? 0) === 0) {
            skippedReasons.update_failed = (skippedReasons.update_failed ?? 0) + 1;
            return;
          }
          // §G-1: 본문이 바뀌면 링크도 바뀐다. 대장을 같이 갱신한다.
          await recordSiteLinks(admin, existingPost.id, body);
          refreshed++;
          titles.push(`(갱신) ${pTitle}`);
          return;
        }

        const res = await safeBlogInsert(admin, {
          slug: pSlug,
          title: pTitle,
          content: body,
          excerpt: pExcerpt,
          category: 'apt',
          tags: pTags,
          source_type: 'auto',
          cron_type: CRON_TYPE,
          // ⚠️ hub_apt_slug 는 넘기지 않는다. safeBlogInsert 가 본문 링크 중
          //    **리드폼이 뜨는 현장**을 우선해 고른다 (§2-2 후속).
        });

        if (res.success) {
          created++;
          titles.push(pTitle);
        } else {
          skippedReasons[res.reason ?? 'unknown'] = (skippedReasons[res.reason ?? 'unknown'] ?? 0) + 1;
          // ⚠️ reason 만으로는 원인을 못 찾는다 — TITLE_TOO_LONG 이 duplicate_slug 로 뭉개진 전례가 있다.
          skippedMessages.push(`${dst.sigungu}/${kind}: ${res.reason}${res.message ? ` (${res.message.slice(0, 120)})` : ''}`);
        }
      };

      /* ── 본편 ── */
      // ⚠️ 부분집합 게이트를 다시 계산한다. digest 의 rich 는 구 전체 기준이라
      //    재건축을 빼고 나면 남은 것이 얇을 수 있다.
      if (subsetPublishable(mainItems)) {
        const movedMain = new Set<string>(mainItems.map((i) => i.slug).filter((s) => movedAll.has(s)));
        const orderedMain = [...mainItems].sort(
          (a, b) => Number(movedMain.has(b.slug)) - Number(movedMain.has(a.slug)),
        );
        // ⚠️ 브랜드명 단독 행을 대표로 쓰지 않는다. 실측:
        //    「부산진구 재개발 총정리 — 아크로 라로체, 범천1-1 재개발, 부산 범천1-1구역 재개발」
        //    ① 아크로 라로체는 구역명이 아니라 분양 브랜드다
        //    ② 범천1-1 이 표기만 다른 채 두 번 올라왔다 (병합됐지만 정규화 DISTINCT 로 재발을 막는다)
        const top3 = pickRepresentatives(orderedMain, dst.region, 3).join(', ');
        // ⚠️ 분리했으면 본편의 대표 유형은 재건축이 아니다. 남은 것으로 다시 정한다.
        const kind = split ? '재개발' : typeLabel(d.dominant_type);
        await emit(
          'main',
          `${dst.region}-${dst.sigungu}-정비사업-총정리`.replace(/\s+/g, '-').toLowerCase(),
          `${dst.region} ${dst.sigungu} ${kind} 총정리 — ${top3} 등 ${mainItems.length}곳 (${ym})`,
          mainItems,
          `${dst.region} ${dst.sigungu} ${kind} ${mainItems.length}곳의 ${ym} 기준 진행 단계와 시공사·세대수를 구역별로 정리했습니다.`,
          [dst.region, dst.sigungu, '재개발', '정비사업'],
        );
      } else {
        skippedNotPublishable++;
      }

      /* ── 재건축 분리편 ── */
      if (split && subsetPublishable(rebuildItems)) {
        const movedRe = new Set<string>(rebuildItems.map((i) => i.slug).filter((s) => movedAll.has(s)));
        const orderedRe = [...rebuildItems].sort(
          (a, b) => Number(movedRe.has(b.slug)) - Number(movedRe.has(a.slug)),
        );
        // ⚠️ 제목형을 본편과 다르게 한다 (실측으로 통과 확인된 형태).
        //    「총정리」→「단지 현황」 · 대표 3곳 → **2곳** · 항목의 `재건축` 접미어 제거.
        //    접미어를 남기면 `A 재건축, B 재건축` 이 되어 본편과 토큰이 다시 겹친다.
        //    ⚠️ `소규모` 를 같이 떼야 한다. 원 이름이 `신서면아파트 소규모재건축` 이라
        //       `재건축` 만 떼면 `신서면아파트 소규모` 라는 꼬리가 제목에 남는다.
        const top2 = pickRepresentatives(orderedRe, dst.region, 2, true).join(', ');
        await emit(
          'rebuild',
          // ⚠️ slug 도 본편과 달라야 한다. 같으면 URL 충돌이다.
          `${dst.region}-${dst.sigungu}-재건축-현황`.replace(/\s+/g, '-').toLowerCase(),
          `${dst.region} ${dst.sigungu} 재건축 단지 현황 — ${top2} 등 ${rebuildItems.length}곳 (${ym})`,
          rebuildItems,
          `${dst.region} ${dst.sigungu}에서 재건축이 진행 중인 단지 ${rebuildItems.length}곳의 ${ym} 기준 단계와 시공사·세대수를 정리했습니다.`,
          [dst.region, dst.sigungu, '재건축', '정비사업'],
        );
      } else if (split) {
        skippedReasons.rebuild_not_publishable = (skippedReasons.rebuild_not_publishable ?? 0) + 1;
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
        skipped_messages: skippedMessages,
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
