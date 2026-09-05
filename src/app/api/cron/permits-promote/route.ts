import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { fetchAll } from '@/lib/db/fetchBatched';
import { extractDong } from '@/lib/permits/match';
import {
  adBlockedFor, isProvisional, judgeSupplyType, normName, provisionalSlug, stripProvisional,
} from '@/lib/presale/candidate';
import { extractZoneTokens as zoneTokens } from '@/lib/permits/match';

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
 * 인허가 원문에서 «사업명» 만 남긴다.
 *
 * ⚠️ 첫 예행이 이걸 안 하고 돌았더니 현장 이름이 이렇게 나왔다:
 *      「부산광역시 부산진구 범천동 858-6번지 일원 희망더함아파트」
 *      「울산 광역시 남구 신정동 563-1 일원 주상복합 신축공사」
 *    이름이자 곧 URL 이다. 행정 접두와 지번을 달고 페이지를 만들면 되돌리기 어렵다.
 * ⛔ 그렇다고 «지어내지» 않는다 — 원문에서 «빼기만» 한다(D2).
 */
function cleanProjectName(raw: string): string {
  let t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  // ⛔ 행정 접두는 «머리에서만» 뗀다. 문자열 아무 데서나 「…구」를 털면 사업명을 물어 뜯는다 —
  //    2차 예행에서 실제로 그랬다: 「창원 풍호장천지구 1BL」 → 「창원 풍 1BL」,
  //    「판문도시개발사업지구 2BL」 → 「판문도시개 2BL」. `지구` 의 '구' 를 시군구로 읽은 것이다.
  //    (기존 `extractZoneCodes` 주석의 「무동지구의 '구' 까지 물어 뜯는다」와 같은 함정.)
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(/^(?:부산|울산)\s*광역시\s*/, '')
      .replace(/^(?:경상남도|창원특례시)\s*/, '')
      .replace(/^[가-힣]{2,4}(?:시|군|구)\s+/, '');
    if (t === before) break;
  }
  // ⚠️ 동+지번은 «남긴다». 그것이 이 사업을 가리키는 유일한 식별자인 원문이 많다
  //    (「다대동 370-11번지 일원 공동주택」 3,002세대). 떼면 이름이 「공동주택」만 남는다.
  return t.replace(/\s*신축공사\s*$/, '').replace(/\s+/g, ' ').trim();
}

/**
 * 사업명으로 쓸 수 있는가.
 * ⛔ 브랜드 «단독» 은 거부한다 — 「힐스테이트」·「호반 써밋」이 실제로 원문에 그렇게 온다.
 *    그 이름으로 만든 페이지는 어느 현장도 가리키지 못한다(PL-A 판정 ① 과 같은 종).
 * 통과 조건: 구역·지구·블록 식별자가 있거나, 법정동 이름이 남아 있을 것.
 */
function usableAsProject(cleaned: string): boolean {
  if (cleaned.length < 5) return false;
  if (/^(아파트|공동주택)( 및|$)/.test(cleaned)) return false;
  const hasZone = zoneTokens(cleaned).length > 0 || /(구역|지구|BL|블록|블럭)/i.test(cleaned);
  const hasDong = Boolean(extractDong(cleaned));
  return hasZone || hasDong;
}

/** 같은 사업의 분할 인허가를 한 덩어리로 — 단지·블록 꼬리를 턴 이름이 키다. */
function projectKey(name: string | null | undefined): string {
  return cleanProjectName(String(name ?? ''))
    .replace(/[()（）\[\]]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/(\d+단지|\d+BL|\d+블록|\d+블럭|[A-Z]-?\d+블록?|[A-Z]-\d+)/g, '')
    .replace(/(공동주택|주상복합|주거복합|신축공사|아파트)$/g, '')
    .trim();
}

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
    const k = `${p.sigungu ?? ''}|${projectKey(p.project_name)}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  // ⚠️ 중복 판정을 slug 동일성으로만 하면 샌다. 첫 예행에서 「광안동 373BL 가로주택 정비사업」이
  //    이미 있는 「광안동 373블럭 가로주택정비」와 «다른 slug» 라 새로 만들어질 뻔했다.
  //    그래서 ① 이름 정규화 키 ② 같은 시군구의 구역 토큰 — 세 축으로 본다.
  const siteRows = (await fetchAll(admin, 'apt_sites',
    'slug, name, display_name, name_variants, sigungu',
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
      if (r.sigungu) for (const t of zoneTokens(n)) existingZoneKeys.add(`${r.sigungu}|${t}`);
    }
  }

  const stat = { groups: groups.size, permits: permits.length, created: 0, skipped_slug: 0, skipped_name: 0, skipped_dup: 0, absorbed: 0 };
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
    const dupByZone = rep.sigungu && zoneTokens(rawName).some((t) => existingZoneKeys.has(`${rep.sigungu}|${t}`));
    if (dupByName || dupByZone) {
      stat.skipped_dup++;
      skipped.push({ key, name: rawName, why: dupByName ? '이름 키 중복 — 기존 현장 있음(검수)' : '구역 토큰 중복 — 기존 현장 있음(검수)' });
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
      if (rep.sigungu) for (const t of zoneTokens(rawName)) existingZoneKeys.add(`${rep.sigungu}|${t}`);
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
    if (rep.sigungu) for (const t of zoneTokens(rawName)) existingZoneKeys.add(`${rep.sigungu}|${t}`);
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
