import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { fetchAll } from '@/lib/db/fetchBatched';
// ⚠️ 구역 식별자는 «두 함수» 가 나눠 갖고 있다. extractZoneTokens 는 「대연8」·「서금사6」
//    같은 동명+번호형이고, 기존 extractZoneCodes 는 「A-5」·「373BL」·「내이3지구」형이다.
//    중복 판정에서 한쪽만 쓰면 다른 형태가 통째로 샌다 — 실제로 「광안동 373BL」이
//    이미 있는 「광안동 373블럭 가로주택정비」를 못 보고 새로 만들 뻔했다(5차 예행).
import { extractDong, extractZoneCodes, extractZoneTokens } from '@/lib/permits/match';

/**
 * ⚠️ extractZoneCodes 의 「BL<번호>」는 «약한» 식별자다. 「1BL」·「2BL」은 어느 지구에나 있고
 *    같은 시군구 안에서 서로 다른 사업이 같은 키가 된다 — 6차 예행에서 「창원 풍호장천지구
 *    1BL」이 무관한 현장과 중복 판정됐다. 지번형(373BL)이나 영문+번호(A5·B14)만 남긴다.
 */
const STRONG = (t: string): boolean => !/^BL\d{1,2}$/.test(t);
const zoneTokens = (s: string | null | undefined): string[] =>
  [...new Set([...extractZoneTokens(s), ...extractZoneCodes(s).filter(STRONG)])];
// ⚠️ 이름 판정은 lib 에 있다. 라우트 안에 두었더니 이름 결함을 «배포해야만» 볼 수 있었고
//    세 번 연속으로 냈다. 지금은 permits-promote-name.test.ts 가 로컬에서 잡는다.
import { cleanProjectName, projectKey, usableAsProject } from '@/lib/permits/promote-name';
import {
  adBlockedFor, isProvisional, judgeSupplyType, normName, provisionalSlug, stripProvisional,
} from '@/lib/presale/candidate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * PV2-C — 큐를 현장으로. 인허가·후보에서 «자동으로» 시드한다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * B(매칭)를 고쳐도 게이트 ①은 닫히지 않는다. 남은 미매칭의 상당수는 «있는데 안 이어진»
 * 것이 아니라 **현장이 아예 없는** 것이기 때문이다(명지 A-5BL · 상남산호지구 · 판문지구…).
 * 그건 매칭이 아니라 생성의 문제다.
 *
 * ⛔ **수동 시드가 아니다(D2).** 사람이 이름을 지어 넣는 행은 0이다 — 이름·세대수·시기가
 *    전부 원문에서 온다. `stage_source='permit:<id>'` 가 그 출처를 들고 있다.
 * ⛔ 현장 형태는 기존 시드와 «같게» 앉힌다(builder-presale-crawl 의 seedSite 와 동형):
 *    site_type='subscription' · lifecycle_stage='pre_announcement' · confidence='estimated'.
 *    형태를 새로 만들면 화면·집계가 갈린다.
 * ⛔ stage_source 를 «명시» 하므로 stage-derive 크론이 이 행의 단계를 덮지 않는다(H7-2 준수).
 * ⚠️ 착공 ≠ 분양. 시기는 `expected_sale_period` 로 넣되 원문 정밀도(`YYYY-MM`)를 지키고
 *    `expected_sale_source='permit'` 을 남긴다. 상향 추정을 하지 않는다.
 *
 *   ?dry=1     판정만
 *   ?limit=N   생성 상한(기본 60) — 한 번에 쏟지 않는다
 */
const REGIONS = ['부산', '울산', '경남'];

/**
 * 시공사 추출. ⛔ 「선정·수주·계약」 문맥이 있을 때만 쓴다.
 * ⚠️ 인허가의 `builder` 칸에는 시행자·설계자가 섞여 들어온 이력이 있다. 문맥 없이 옮기면
 *    「○○종합건설」이 브랜드처럼 화면에 선다 — CV-B ①-2 가 광고에서 지운 그 형태다.
 */
function builderOf(p: Record<string, any>): string | null {
  const raw = (p.builder ?? '').trim();
  if (!raw) return null;
  const ctx = `${p.project_name ?? ''} ${p.raw ? JSON.stringify(p.raw) : ''}`;
  return /선정|수주|계약/.test(ctx) ? raw : null;
}

/** 착공예정일 → `YYYY-MM`. ⚠️ 일(day)까지 남기지 않는다 — 그 정밀도는 분양시기의 것이 아니다. */
function periodOf(d: string | null | undefined): string | null {
  const s = String(d ?? '');
  const m = s.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

async function handler(req: NextRequest) {
  const admin = getSupabaseAdmin() as any;
  const sp = req.nextUrl.searchParams;
  const dry = sp.get('dry') === '1';
  const limit = Math.min(Number(sp.get('limit') || 60), 300);
  const started = Date.now();

  // ── ⓐ 대상 인허가: 재판정 후에도 no_target 인 것 ──────────────────────────
  const permits = (await fetchAll(admin, 'apt_permits',
    'id, sido, sigungu, address, project_name, builder, developer, total_units, construct_start_expected, permit_date, raw',
    (q: any) => q.in('sido', REGIONS).eq('match_status', 'no_target')
      .gte('construct_start_expected', '2026-01-01').lt('construct_start_expected', '2029-01-01')
      .gte('total_units', 300))) as Array<Record<string, any>>;

  // 같은 사업의 분할 인허가는 «최대 세대수 1행» 이 대표. 나머지는 source_ids 로 흡수한다.
  const groups = new Map<string, Array<Record<string, any>>>();
  for (const p of permits) {
    const k = `${p.sigungu ?? ''}|${projectKey(p.project_name, p.sigungu)}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  // ⚠️ 중복 판정을 slug 동일성으로만 하면 샌다. 첫 예행에서 「광안동 373BL 가로주택 정비사업」이
  //    이미 있는 「광안동 373블럭 가로주택정비」와 «다른 slug» 라 새로 만들어질 뻔했다.
  //    그래서 ① 이름 정규화 키 ② 같은 시군구의 구역 토큰 — 세 축으로 본다.
  const siteRows = (await fetchAll(admin, 'apt_sites',
    'id, slug, name, display_name, name_variants, region, sigungu, dong, lifecycle_stage, total_units, complex_units, is_active',
    (q: any) => q.in('region', REGIONS))) as Array<Record<string, any>>;
  const existingSlugs = new Set<string>(siteRows.map((r) => r.slug));
  const existingNameKeys = new Set<string>();
  const existingZoneKeys = new Set<string>();
  for (const r of siteRows) {
    const names = [r.name, r.display_name, ...(Array.isArray(r.name_variants) ? r.name_variants : [])]
      .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
    for (const n of names) {
      const k = normName(n);
      if (k) existingNameKeys.add(k);
      if (r.sigungu) for (const t of zoneTokens(n)) existingZoneKeys.add(`${r.region}|${r.sigungu}|${t}`);
    }
  }

  /**
   * PV2-C 보강 — 「세대수 NULL 유령」 검사 (세션 A 실측, 2026-09-05).
   *
   * ── 왜 ────────────────────────────────────────────────────────────────
   * 1차 승인 직전 교차 검증에서 19건 중 3건이 «이미 있는 현장» 이었다:
   *   범천동 858-6(614) ↔ `부산-범천동-주상복합`   (pre_announcement · 세대수 NULL · 주소 공백)
   *   중동 주상복합(516) ↔ `해운대-중동-동원로얄듀크`(pre_announcement · 세대수 NULL)
   *   명륜동(747)        ↔ `명륜2-재건축`          (mgmt_approved · 504 — 33% 차)
   * 셋 다 이름·slug·구역 토큰이 겹치지 않아 앞의 세 축이 전부 통과시켰다.
   *
   * ⛔ 공통 원인이 구조적이다 — `seed:web` 레코드는 **세대수 NULL·주소 공백**이라
   *    매처의 «세대수 축과 지번 축을 둘 다» 못 쓴다. 이름도 「범천동 주상복합」처럼
   *    일반명사라 이름 축도 못 쓴다. 그래서 매처가 못 이었고, 여기가 「없다」고 읽었다.
   * ⚠️ 「매처가 못 이은 것」과 「실제로 없는 것」은 다르다. 그 둘을 가르지 못하면
   *    승격이 유령의 쌍둥이를 만든다 — 그리고 그것은 되돌리기 어렵다.
   *
   * 판정: 같은 법정동(동이 없으면 같은 시군구)에 «공고 전» 활성 현장이 있고
   *   ⓐ 세대수를 모르거나            → 겹칠 수 있다
   *   ⓑ 세대수가 ±40% 안이거나       → 같은 사업일 수 있다(명륜동 504/747 = 33%)
   * 이면 **만들지 않고 review 로 보낸다.** ⛔ 억지로 matched 로 잇지도 않는다 —
   *    범천동처럼 «확정으로 올릴» 판단은 사람이 하고, 여기는 후보만 적어 큐에 남긴다.
   */
  const PRE_STAGES = new Set([
    'pre_announcement', 'union_established', 'site_planning', 'plan_approved',
    'mgmt_approved', 'constructor_selected',
  ]);
  const preSites = siteRows.filter(
    (r) => r.is_active !== false && PRE_STAGES.has(String(r.lifecycle_stage ?? '')),
  );
  // ⚠️ 5차 예행에서 이 검사가 19건 중 17건을 잡았다 — 과잉이다. 원인 둘:
  //   ① 「구 전체」 폴백. 동이 없는 현장을 같은 «구» 의 아무 인허가에나 붙였다 —
  //      「상남1구역 재건축」이 창원의 dong 없는 현장 둘에 걸렸다. 근거가 아니다. 폴백을 없앤다.
  //   ② 시군구 키에 시도가 없어 «부산 남구» 와 «울산 남구» 가 섞였다
  //      (울산 신정동 건이 부산 문현4동 현장에 걸렸다). 키에 시도를 넣는다.
  // 실제로 잡아야 했던 셋(범천동·중동·명륜동)은 «전부 같은 법정동» 이었다.
  const preByDong = new Map<string, Array<Record<string, any>>>();
  for (const r of preSites) {
    if (!r.dong || !r.region) continue;
    const k = `${r.region}|${r.dong}`;
    preByDong.set(k, [...(preByDong.get(k) ?? []), r]);
  }
  const UNITS_NEAR = 0.4;
  const collides = (p: Record<string, any>): Array<Record<string, any>> => {
    const dong = extractDong(p.address);
    if (!dong) return [];
    const pool = preByDong.get(`${p.sido}|${dong}`) ?? [];
    const units = Number(p.total_units ?? 0);
    return pool.filter((r) => {
      const u = r.complex_units ?? r.total_units;
      // ⓐ 「공고 전 · 세대수 미상」 시드는 매처의 두 축(세대수·지번)을 다 못 쓴다.
      //    그 부류만 «모른다» 로 잡는다 — 정비 단계 구역까지 세면 동 하나에 수십 건이 걸린다.
      if (u == null) return String(r.lifecycle_stage) === 'pre_announcement';
      // ⓑ 세대수가 가까우면 같은 사업일 수 있다(명륜2 504 ↔ 인허가 747 = 33%).
      if (!units) return false;
      return Math.abs(units - u) / Math.max(units, u) <= UNITS_NEAR;
    });
  };

  const stat = { groups: groups.size, permits: permits.length, created: 0, skipped_slug: 0, skipped_name: 0, skipped_dup: 0, held_ghost: 0, absorbed: 0 };
  const created: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  let writeFails = 0;
  let firstWriteError: string | null = null;

  for (const [key, rows] of groups) {
    if (stat.created >= limit) { stat.skipped_name += 1; continue; }
    const rep = [...rows].sort((a, b) => (b.total_units ?? 0) - (a.total_units ?? 0))[0];
    const rawName = cleanProjectName(String(rep.project_name ?? ''));
    // ⛔ 이름이 «사업명이 아닌» 것은 만들지 않는다 — 브랜드 단독·「아파트 및 부대복리시설」류.
    if (!usableAsProject(rawName)) {
      stat.skipped_name++;
      skipped.push({ key, raw: rep.project_name, cleaned: rawName, why: '사업명으로 쓸 수 없는 원문(브랜드 단독·식별자 없음)' });
      continue;
    }
    // ⛔ 이미 있는 현장이면 만들지 않는다. 이름 키 또는 같은 시군구의 구역 토큰이 겹치면 중복이다.
    const dupByName = existingNameKeys.has(normName(rawName));
    const dupByZone = rep.sigungu && zoneTokens(rawName).some((t) => existingZoneKeys.has(`${rep.sido}|${rep.sigungu}|${t}`));
    if (dupByName || dupByZone) {
      stat.skipped_dup++;
      skipped.push({ key, name: rawName, why: dupByName ? '이름 키 중복 — 기존 현장 있음(검수)' : '구역 토큰 중복 — 기존 현장 있음(검수)' });
      continue;
    }
    // ⛔ 유령 검사 — 매처가 못 이었을 뿐 «있는» 현장일 수 있다. 만들지 않고 큐로 보낸다.
    const ghosts = collides(rep);
    if (ghosts.length) {
      stat.held_ghost++;
      const note = `PV2-C 보류 — 같은 동/구의 공고 전 현장과 겹칠 수 있다: ${ghosts.map((g) => `${g.slug}(${g.complex_units ?? g.total_units ?? '세대수 미상'})`).join(', ')}`;
      skipped.push({ key, name: rawName, units: rep.total_units, why: note.slice(0, 200) });
      if (!dry) {
        for (const r of rows) {
          // review 로 옮겨 다음 회전이 같은 사업을 다시 만들지 않게 한다.
          // ⚠️ matched_site_id 는 «비워 둔다» — 확정이 아니다(라우트의 불변식).
          const { error: e3 } = await admin.from('apt_permits').update({
            match_status: 'review', match_method: 'ghost_hold',
            match_note: note.slice(0, 300), matched_at: new Date().toISOString(),
          }).eq('id', r.id);
          if (e3) { writeFails++; if (firstWriteError == null) firstWriteError = String(e3.message).slice(0, 200); }
        }
      }
      continue;
    }
    const slug = provisionalSlug(rawName);
    if (!slug) { stat.skipped_name++; skipped.push({ key, name: rawName, why: 'slug 생성 불가' }); continue; }
    // 충돌하면 시군구를 접두로 한 번 더 시도한다. 그래도 겹치면 만들지 않는다.
    const slug2 = existingSlugs.has(slug) ? provisionalSlug(`${rep.sigungu ?? ''} ${rawName}`) : slug;
    if (!slug2 || existingSlugs.has(slug2)) {
      stat.skipped_slug++;
      skipped.push({ key, name: rawName, slug, why: 'slug 중복 — 기존 현장이 있을 수 있다(검수)' });
      continue;
    }

    const supply = judgeSupplyType(rawName, rep.address, rep.developer ?? null);
    // 착수조건 ② — 명지 A-5BL·B14BL 은 LH 블록 의심. 판정 전까지 광고 금지.
    const lhSuspect = /명지\s*[AB]-?\d+\s*BL/i.test(rawName.replace(/\s+/g, ' '));
    const adBlocked = adBlockedFor(supply) || lhSuspect;

    const row = {
      slug: slug2,
      name: stripProvisional(rawName),
      display_name: isProvisional(rawName) ? rawName : null,
      site_type: 'subscription',
      region: rep.sido,
      sigungu: rep.sigungu,
      dong: extractDong(rep.address),
      address: rep.address,
      builder: builderOf(rep),
      total_units: rep.total_units,
      lifecycle_stage: 'pre_announcement',
      stage_source: `permit:${rep.id}`,
      expected_sale_period: periodOf(rep.construct_start_expected),
      expected_sale_source: 'permit',
      confidence: 'estimated',
      confidence_note: `인허가 원문 — 착공예정 ${rep.construct_start_expected ?? '?'} · 분할 ${rows.length}건`,
      supply_type: supply,
      ad_blocked: adBlocked,
      ad_blocked_reason: lhSuspect ? 'supply_type 미판정·LH 블록 의심'
        : (adBlockedFor(supply) ? `공급유형 ${supply}` : null),
      source_ids: { permit_ids: rows.map((r) => r.id), permit_source: 'apt_permits' },
      is_active: true,
    };

    if (dry) {
      stat.created++;
      created.push({ slug: slug2, name: row.name, units: row.total_units, period: row.expected_sale_period, supply, ad_blocked: adBlocked, split: rows.length });
      existingSlugs.add(slug2);
      existingNameKeys.add(normName(rawName));
      if (rep.sigungu) for (const t of zoneTokens(rawName)) existingZoneKeys.add(`${rep.sido}|${rep.sigungu}|${t}`);
      continue;
    }

    const { data: ins, error } = await admin.from('apt_sites').insert(row).select('id').single();
    if (error || !ins?.id) {
      writeFails++;
      if (firstWriteError == null) firstWriteError = String(error?.message ?? 'no id').slice(0, 200);
      continue;
    }
    existingSlugs.add(slug2);
    existingNameKeys.add(normName(rawName));
    if (rep.sigungu) for (const t of zoneTokens(rawName)) existingZoneKeys.add(`${rep.sido}|${rep.sigungu}|${t}`);
    stat.created++;
    created.push({ slug: slug2, name: row.name, units: row.total_units, period: row.expected_sale_period, supply, ad_blocked: adBlocked, split: rows.length });

    // ⚠️ 만든 «즉시» 인허가를 이 현장에 붙인다. 안 붙이면 다음 회전이 같은 사업을 또 만든다.
    for (const r of rows) {
      const { error: e2 } = await admin.from('apt_permits').update({
        match_status: 'matched', matched_site_id: ins.id,
        match_method: 'seed_promote', match_confidence: 'estimated',
        match_note: `PV2-C 승격 — ${slug2}`, matched_at: new Date().toISOString(),
      }).eq('id', r.id);
      if (e2) { writeFails++; if (firstWriteError == null) firstWriteError = String(e2.message).slice(0, 200); }
      else stat.absorbed++;
    }
  }

  return {
    processed: stat.created,
    created: stat.created,
    metadata: {
      dry, limit, ...stat,
      write_fails: writeFails, first_write_error: firstWriteError,
      created_samples: created.slice(0, 30),
      skipped_samples: skipped.slice(0, 20),
      elapsed_ms: Date.now() - started,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('permits-promote', () => handler(req));
  return NextResponse.json(result);
}
