// ADDENDUM §G-1 — 글 ↔ 현장 링크 대장.
//
// ── 왜 필요했나 ──
// 「인바운드 0개 4,212건」이 **틀린 숫자**였다. `hub_apt_slug` 만 세고 있었는데
// 그건 글당 대표 **1개**뿐이라 본문 링크를 못 센다.
//   표본 부산 착공·관리처분 40건 — hub 기준 10건 · 본문 링크 기준 38건
// 어제 발행한 16편이 편당 45~81개 링크를 뿌렸는데 그게 집계에 안 잡히고 있었다.
// 그 결과 **이미 링크가 많은 현장에 또 글을 쓰는** 대상 선정이 돌고 있었다.
//
// ── ⚠️ 본문 LIKE 전체 스캔은 타임아웃이다 ──
// blog_posts.content 를 매번 훑지 말 것. 발행 시점에 이 표에 적어 두고 여기서만 읽는다.
//
// 전체 백필 실측 (2026-08-25):
//   links 5,271 · 커버 현장 855 · 링크 보유 글 1,546
//   hub 과 합집합 기준 인바운드 0개 = **3,809 / 6,049**

import { extractAptSiteSlugs } from '@/lib/blog-safe-insert';

export const SITE_LINK_TABLE = 'blog_site_links';

/**
 * 본문의 현장 링크를 대장에 적는다.
 *
 * ⚠️ PK 가 (blog_id, site_slug) **전체 유니크**라 ON CONFLICT 추론이 된다.
 *    (이 저장소에서 부분 인덱스에 세 번 걸렸다 — 여기서는 확인하고 쓴다.)
 * ⚠️ 실존 현장만 적는다. 죽은 슬러그를 대장에 넣으면 커버리지가 부풀어
 *    「인바운드 0개」 숫자가 다시 거짓말을 한다.
 * ⚠️ **쓰기 결과를 돌려준다.** 삼키면 "기록했다" 는 거짓 카운터가 된다.
 */
export async function recordSiteLinks(
  admin: any,
  blogId: number | string,
  content: string,
): Promise<number> {
  const linked = extractAptSiteSlugs(content ?? '');
  if (linked.length === 0) return 0;

  // 실존 확인. 한 번의 IN 으로 끝낸다.
  const { data: known } = await admin
    .from('apt_sites')
    .select('slug')
    .in('slug', linked.slice(0, 200));

  const valid = (known ?? []).map((r: any) => r.slug);
  if (valid.length === 0) return 0;

  const rows = valid.map((slug: string) => ({ blog_id: blogId, site_slug: slug }));
  const { data, error } = await admin
    .from(SITE_LINK_TABLE)
    .upsert(rows, { onConflict: 'blog_id,site_slug', ignoreDuplicates: true })
    .select('site_slug');

  if (error) {
    console.warn(`[site-links] 기록 실패 blog=${blogId}: ${error.message}`);
    return 0;
  }
  // ignoreDuplicates=true 면 이미 있던 행은 빠진다 — 새로 적힌 것만 세어진다.
  return data?.length ?? 0;
}

export interface ZeroInboundOptions {
  /** 시·도. 생략하면 전국. */
  regions?: string[];
  /** 기축은 제외한다 — 리드가 붙지 않는 단계에 글을 쓰지 않는다. */
  excludeStages?: string[];
  limit?: number;
}

const DEFAULT_EXCLUDE = ['post_move_in', 'active_trade', 'landmark_active'];

/**
 * 링크를 못 받은 현장 — **다음 글의 대상**.
 *
 * ⚠️ hub_apt_slug 로 세지 말 것. 그게 §G-1 의 원인이다.
 *    본문 링크(blog_site_links)와 hub 를 **합집합**으로 본다 —
 *    hub 에만 있는 옛 글도 인바운드는 인바운드다.
 * ⚠️ content LIKE 를 쓰지 말 것. 8,746편 전체 스캔은 타임아웃이다.
 */
export async function zeroInboundSites(admin: any, opts: ZeroInboundOptions = {}) {
  const { regions, excludeStages = DEFAULT_EXCLUDE, limit = 20 } = opts;

  // 링크를 가진 슬러그 집합을 먼저 받는다. 인덱스(blog_site_links_slug)를 탄다.
  const [{ data: linked }, { data: hubbed }] = await Promise.all([
    admin.from(SITE_LINK_TABLE).select('site_slug'),
    admin.from('blog_posts').select('hub_apt_slug').eq('is_published', true).not('hub_apt_slug', 'is', null),
  ]);

  const covered = new Set<string>([
    ...((linked ?? []).map((r: any) => r.site_slug)),
    ...((hubbed ?? []).map((r: any) => r.hub_apt_slug)),
  ]);

  let q = admin
    .from('apt_sites')
    .select('slug, name, display_name, region, sigungu, lifecycle_stage, content_score')
    .eq('is_active', true)
    .order('content_score', { ascending: false, nullsFirst: false })
    // 커버된 만큼 여유를 두고 받아 코드에서 거른다. 슬러그 목록을 NOT IN 으로 넘기면
    // URL 이 너무 길어져 요청 자체가 깨진다.
    .limit(Math.max(limit * 8, 400));

  if (regions && regions.length > 0) q = q.in('region', regions);
  if (excludeStages.length > 0) q = q.not('lifecycle_stage', 'in', `(${excludeStages.join(',')})`);

  const { data: sites } = await q;
  return (sites ?? []).filter((s: any) => !covered.has(s.slug)).slice(0, limit);
}
