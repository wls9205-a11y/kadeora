/**
 * V17 G — 시공사 브랜드 사이트 「분양단지 목록」 동기화.
 *
 * 현장마다 웹 검색을 돌리면 206회다. 브랜드 사이트 목록 한 장이면 시공사 수만큼으로 끝난다.
 * 한 번 조회로 별칭·세대수·조감도·전용 홈페이지를 동시에 얻는다.
 *
 * ── 저장 규칙 (G-5) ──
 *   name_variants                              추가만. 기존 값 삭제 금지
 *   builder · supply_units · complex_units      비어 있을 때만. 덮어쓰기 금지
 *   confidence                                  A등급 = 'confirmed'
 *   lifecycle_stage                             건드리지 않는다. DART·어드민만
 *
 * ⚠️ 부분 문자열 매칭 금지. 이름이 정확히 맞고 **지역까지 일치**해야 채택한다.
 *    확신이 없으면 아무것도 쓰지 않는다.
 *
 * ── 이미지는 별도 규칙 ──
 *   별칭·세대수는 틀리면 고치면 되지만 이미지는 저작물이라 성격이 다르다.
 *   상한도 따로 둔다 (별칭 30 / 이미지 10). lib/builder-sites/hero.ts 주석 참조.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { BUILDER_SITES, type BuilderSite } from '@/lib/builder-sites/registry';
import { parseAddress, parseBuilderList, type BuilderSiteCard } from '@/lib/builder-sites/parse';
import {
  measureFirstUsable,
  pickHeroCandidates,
  robotsAllows,
  verifyBrandFooter,
} from '@/lib/builder-sites/hero';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** G-3 상한 — 하루 20~30건. */
const FIELD_CAP = 30;
/** 이미지는 따로 10건. 되돌릴 일이 생겼을 때 양이 감당돼야 한다. */
const IMAGE_CAP = 10;
/** 누적 페이징 상한. 증분이 멈추면 그 전에 끝난다. */
const MAX_PAGES = 12;

const UA = 'Mozilla/5.0 (compatible; kadeora-bot)';
const norm = (v: string) => v.replace(/\s+/g, '').replace(/[()（）［］[\]]/g, '').toLowerCase();

/** 누적 페이징: currentPage 를 올리며 카드가 늘지 않을 때까지. */
async function fetchAllCards(site: BuilderSite): Promise<BuilderSiteCard[]> {
  let best: BuilderSiteCard[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = site.pageParam ? `${site.listUrl}?${site.pageParam}=${page}` : site.listUrl;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) break;
      const cards = parseBuilderList(await res.text(), site.listUrl);
      // 누적이라 이전보다 늘지 않으면 끝이다.
      if (cards.length <= best.length) {
        best = cards.length > best.length ? cards : best;
        break;
      }
      best = cards;
      if (!site.pageParam) break;
    } catch (e: any) {
      console.warn(`[builder-sync] ${site.key} p${page} 실패: ${e?.message ?? String(e)}`);
      break;
    }
  }
  return best;
}

interface SiteRow {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  builder: string | null;
  supply_units: number | null;
  complex_units: number | null;
  name_variants: unknown;
  hero_image_url: string | null;
}

const COLS =
  'id, slug, name, region, sigungu, builder, supply_units, complex_units, name_variants, hero_image_url';

/**
 * 카드 → 현장. **이름 정확 일치 + 지역 일치**만 채택한다.
 * 후보가 여럿이면 고르지 않는다 — 모르면서 하나를 고르는 게 못 찾는 것보다 나쁘다.
 */
async function matchSite(admin: any, card: BuilderSiteCard): Promise<SiteRow | null> {
  const { region, sigungu } = parseAddress(card.address);
  if (!region) return null;

  const { data } = await admin
    .from('apt_sites')
    .select(COLS)
    .eq('is_active', true)
    .eq('region', region)
    .limit(400);

  const rows = (data ?? []) as SiteRow[];
  const key = norm(card.name);
  const hits = rows.filter((r) => {
    const names = [r.name, ...(Array.isArray(r.name_variants) ? r.name_variants : [])]
      .filter((v): v is string => typeof v === 'string')
      .map(norm);
    if (!names.includes(key)) return false;
    // 시군구를 둘 다 알면 그것도 맞아야 한다. 한쪽이라도 모르면 지역까지만 본다.
    if (sigungu && r.sigungu && norm(r.sigungu) !== norm(sigungu)) return false;
    return true;
  });

  if (hits.length !== 1) {
    if (hits.length > 1) console.log(`[builder-sync] 후보 다수 — ${card.name} (${region}) 채택 안 함`);
    return null;
  }
  return hits[0];
}

async function handler(_req: NextRequest) {
  const result = await withCronLogging('builder-site-sync', async () => {
    const admin = getSupabaseAdmin() as any;

    let scanned = 0;
    let matched = 0;
    let fieldUpdates = 0;
    let imageUpdates = 0;
    let skippedNoMatch = 0;
    const imageLog: Array<{ slug: string; url: string; size: string }> = [];

    for (const site of BUILDER_SITES) {
      const cards = await fetchAllCards(site);
      scanned += cards.length;

      for (const card of cards) {
        if (fieldUpdates >= FIELD_CAP && imageUpdates >= IMAGE_CAP) break;

        const row = await matchSite(admin, card);
        if (!row) {
          skippedNoMatch++;
          continue;
        }
        matched++;

        /* ── 별칭·세대수·시공사 (G-5) ── */
        if (fieldUpdates < FIELD_CAP) {
          const patch: Record<string, unknown> = {};

          // 추가만. 기존 값을 지우지 않는다.
          const existing = (Array.isArray(row.name_variants) ? row.name_variants : []).filter(
            (v: unknown): v is string => typeof v === 'string',
          );
          // 시공사가 자기 사이트에 쓴 정식 단지명. 우리 이름과 다르면 별칭이 된다.
          const add = [card.name].filter(
            (v) => norm(v) !== norm(row.name) && !existing.some((e) => norm(e) === norm(v)),
          );
          if (add.length > 0) patch.name_variants = [...existing, ...add];

          // 비어 있을 때만. 시공사가 자기 사이트에 적은 숫자라 A등급이다.
          if (row.builder == null && site.builder) patch.builder = site.builder;
          if (row.supply_units == null && card.units.supply != null) patch.supply_units = card.units.supply;
          if (row.complex_units == null && card.units.complex != null) patch.complex_units = card.units.complex;

          if (Object.keys(patch).length > 0) {
            // ⚠️ lifecycle_stage 는 넣지 않는다. 단계는 DART·어드민만 정한다.
            patch.confidence = 'confirmed';
            patch.confidence_note = `${site.builder} 공식 브랜드 사이트`;
            patch.updated_at = new Date().toISOString();
            const { error } = await admin.from('apt_sites').update(patch).eq('id', row.id);
            if (error) console.warn(`[builder-sync] 필드 갱신 실패 ${row.slug}: ${error.message}`);
            else fieldUpdates++;
          }
        }

        /* ── 조감도 (제약 5가지) ── */
        // ③ 이미 있으면 덮어쓰지 않는다.
        if (imageUpdates >= IMAGE_CAP || row.hero_image_url) continue;

        // ① 목록 썸네일이 아니라 상세의 큰 이미지. 상세가 없으면 전용 홈페이지.
        let pageUrl: string | null = null;
        let aGrade = false;
        if (card.detailNo) {
          pageUrl = new URL(`/${site.kind}/view/${card.detailNo}`, site.listUrl).toString();
          aGrade = true; // 시공사 공식 도메인 = A등급
        } else if (card.homepage) {
          pageUrl = card.homepage;
        }
        if (!pageUrl) continue;

        // ⚠️ 우리 레지스트리 밖 도메인은 robots 를 확인하고 들어간다. 우회하지 않는다.
        if (!aGrade && !(await robotsAllows(pageUrl))) {
          console.log(`[builder-sync] robots 차단 — 이미지 건너뜀: ${pageUrl}`);
          continue;
        }

        let html: string;
        try {
          const res = await fetch(pageUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
          if (!res.ok) continue;
          html = await res.text();
        } catch {
          continue;
        }

        // ④ 전용 홈페이지는 푸터에 시공사명 + 사업자등록번호가 있어야 A등급이다.
        if (!aGrade && !verifyBrandFooter(html, site.builder)) {
          console.log(`[builder-sync] A등급 아님 — 이미지 건너뜀: ${pageUrl}`);
          continue;
        }

        const picked = await measureFirstUsable(pickHeroCandidates(html, pageUrl));
        if (!picked) continue;

        // ② credit 은 시공사명만. 화면에 그대로 나간다 — URL·수집일·경로를 넣지 않는다.
        const coverRes = await fetch(new URL('/api/admin/apt-cover', process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.app').toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
          },
          body: JSON.stringify({ slug: row.slug, url: picked.url, credit: site.builder }),
          signal: AbortSignal.timeout(60_000),
        }).catch(() => null);

        const body = coverRes ? await coverRes.json().catch(() => null) : null;
        if (!coverRes?.ok || !body) {
          console.warn(`[builder-sync] 조감도 저장 실패 ${row.slug}: ${coverRes?.status ?? 'network'}`);
          continue;
        }
        imageUpdates++;
        // ⑤ 롤백 대상을 특정할 수 있게 저장된 URL 을 남긴다.
        const stored = body.hero_image_url ?? body.url ?? '(응답에 URL 없음)';
        imageLog.push({ slug: row.slug, url: stored, size: `${picked.width}x${picked.height}` });
        console.log(`[builder-sync] 조감도 저장 ${row.slug} ${picked.width}x${picked.height} → ${stored}`);
      }
    }

    return {
      processed: scanned,
      created: fieldUpdates + imageUpdates,
      failed: 0,
      metadata: {
        sites: BUILDER_SITES.length,
        scanned,
        matched,
        skipped_no_match: skippedNoMatch,
        field_updates: fieldUpdates,
        image_updates: imageUpdates,
        field_cap: FIELD_CAP,
        image_cap: IMAGE_CAP,
        images: imageLog,
      },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
