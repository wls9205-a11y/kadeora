// V16 E-1 — DART 공급계약 공시 한 건을 정비사업 현장에 반영한다.
//
// 목표: 공시 게시 → 화면 노출 30분 이내. dart-ingest 가 평일 15분마다 도니까
// 그 안에서 끝내야 한다 — 별도 크론으로 미루면 15분이 한 번 더 붙는다.
//
// ⚠️ 전부 큐로 보내면 속도가 죽는다. 확실한 건 자동 반영하고, 애매한 것만 큐로 보낸다.
// ⚠️ 확신이 없으면 **아무것도 쓰지 않는다.** 잘못된 매칭은 없는 것보다 나쁘다 —
//    confidence='confirmed' 로 화면에 나가고 광고 랜딩까지 흘러간다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchFilingBody } from '@/lib/dart/filing-body';
import {
  bodyMentionsRedev,
  extractZoneNames,
  matchSite,
  type CandidateSite,
  type MatchOutcome,
} from '@/lib/dart/redev-match';

/** 검수 큐 테이블. 없으면 경고만 남기고 넘어간다 (DDL 은 STATUS.md 참조). */
export const REVIEW_TABLE = 'apt_stage_review_queue';

/** 공급계약 공시가 알리는 단계는 하나다 — 시공사 선정. */
const TARGET_STAGE = 'constructor_selected';

export interface RedevFiling {
  rcept_no: string;
  corp_name: string;
  report_nm: string;
  filed_at: string | null;
}

export type RedevResult =
  | { kind: 'discard'; reason: string }
  | { kind: 'queue'; reason: string }
  | { kind: 'auto'; slug: string; changed: boolean };

const dartUrl = (rceptNo: string) => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;

/** 구역명 하나로 후보 현장을 찾는다. name 정확 일치 + name_variants 포함, 둘 다 본다. */
async function candidatesForZone(admin: any, zone: string): Promise<CandidateSite[]> {
  const cols = 'id, slug, name, builder, name_variants';
  const out: CandidateSite[] = [];

  const { data: byName } = await admin
    .from('apt_sites').select(cols).eq('is_active', true).eq('name', zone).limit(5);
  out.push(...((byName ?? []) as CandidateSite[]));

  const { data: byVariant } = await admin
    .from('apt_sites').select(cols).eq('is_active', true)
    .contains('name_variants', [zone]).limit(5);
  out.push(...((byVariant ?? []) as CandidateSite[]));

  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

/**
 * 재처리 결과 사람이 볼 필요가 없어진 pending 행을 닫는다.
 * ⚠️ 삭제하지 않는다 — 왜 빠졌는지가 남아야 다음에 같은 판단을 다시 하지 않는다.
 */
async function dropPending(admin: any, rceptNo: string, reason: string) {
  await admin
    .from(REVIEW_TABLE)
    .update({ status: 'discarded', reason, resolved_at: new Date().toISOString(), reviewed_by: 'system' })
    .eq('rcept_no', rceptNo)
    .eq('status', 'pending');
}

async function enqueue(admin: any, f: RedevFiling, outcome: Extract<MatchOutcome, { kind: 'queue' }>) {
  const row = {
    rcept_no: f.rcept_no,
    corp_name: f.corp_name,
    report_nm: f.report_nm,
    source_url: dartUrl(f.rcept_no),
    // ⚠️ 이걸 안 실어서 큐 3건이 전부 filed_at=null 이었다. 「30분 이내」 목표를 잴 수 없었다.
    //    ⚠️ DART 의 rcept_dt 는 **날짜만** 준다(시각 없음). filed_at 만으로는 분 단위를 못 잰다 —
    //       실제 경과는 created_at(우리가 수집한 시각) ↔ resolved_at 으로 봐야 한다.
    filed_at: f.filed_at,
    zone_candidates: outcome.zones,
    reason: outcome.reason,
    proposed_stage: TARGET_STAGE,
    status: 'pending',
  };

  // ⚠️ upsert 를 쓰지 않는다. rcept_no 유니크가 **부분 인덱스**다
  //    (apt_stage_review_queue_rcept_pending … WHERE status='pending').
  //    ON CONFLICT (rcept_no) 는 부분 인덱스를 추론하지 못해 42P10 으로 죽는다 —
  //    서울 크롤러의 idx_redev_external_id 와 같은 함정이다. 명시적으로 가른다.
  const { data: existing } = await admin
    .from(REVIEW_TABLE)
    .select('id')
    .eq('rcept_no', f.rcept_no)
    .eq('status', 'pending')
    .maybeSingle();

  const { error } = existing
    ? await admin.from(REVIEW_TABLE).update(row).eq('id', existing.id)
    : await admin.from(REVIEW_TABLE).insert(row);

  if (error) {
    // 테이블이 아직 없어도 크론을 죽이지 않는다. 다만 조용히 넘기지도 않는다.
    console.warn(`[dart/redev] 검수 큐 적재 실패 (${f.rcept_no}): ${error.message}`);
  }
}

/**
 * 공시 한 건 처리. 1차 필터(건설사 여부)는 **호출부가 이미 통과시킨 상태**로 들어온다.
 * 여기서는 본문 조건부터 본다.
 */
export async function processRedevFiling(f: RedevFiling, apiKey: string): Promise<RedevResult> {
  // database.ts 가 lifecycle_stage·apt_site_events 를 아직 모른다 (저장소 as any 관례).
  const admin = getSupabaseAdmin() as any;

  const fetched = await fetchFilingBody(f.rcept_no, apiKey);
  if (!fetched.ok) {
    // 본문을 못 받았으면 자동 반영으로 넘어가지 않는다. 사람이 본다.
    // ⚠️ 원인을 reason 에 그대로 싣는다. `body_fetch_failed` 만으로는 401 인지 ZIP 파싱
    //    실패인지 EUC-KR 인지 알 수 없어 큐 3건을 아무도 판단하지 못했다.
    //    런타임 로그는 하루면 사라지므로 **행에 남겨야** 한다.
    const reason = `body_fetch_failed:${fetched.reason}${fetched.detail ? ` (${fetched.detail})` : ''}`.slice(0, 300);
    await enqueue(admin, f, { kind: 'queue', reason, zones: [] });
    return { kind: 'queue', reason };
  }
  const body = fetched.text;

  // ⚠️ 1차 필터의 나머지 절반. 이게 조선·전자·인프라를 떨어뜨린다 —
  //    실측 오탐원: HJ중공업 · 삼성중공업 · 한화오션 · 현대오토에버.
  //    DL이앤씨·동부건설의 `단일판매ㆍ공급계약체결` 도 철도·인프라(수서~광주 복선전철 등)가
  //    많다. 본문이 안 열리는 동안은 이 필터가 작동하지 못해 전부 큐로 흘렀다.
  //    여기 걸리면 **큐에도 넣지 않고 버린다.**
  if (!bodyMentionsRedev(body)) {
    // 본문이 안 열리던 시절에 큐로 들어간 행이 있으면 여기서 정리한다.
    // 사람이 볼 필요가 없어진 건을 pending 으로 남겨 두면 큐가 인프라 공시로 채워진다.
    await dropPending(admin, f.rcept_no, 'body_not_redev');
    return { kind: 'discard', reason: 'body_not_redev' };
  }

  const zones = extractZoneNames(body);
  if (zones.length === 0) {
    await enqueue(admin, f, { kind: 'queue', reason: 'no_zone_in_body', zones: [] });
    return { kind: 'queue', reason: 'no_zone_in_body' };
  }

  const candidates: CandidateSite[] = [];
  for (const z of zones) candidates.push(...(await candidatesForZone(admin, z)));

  const outcome = matchSite(zones, f.corp_name, candidates);
  if (outcome.kind === 'queue') {
    await enqueue(admin, f, outcome);
    return { kind: 'queue', reason: outcome.reason };
  }
  if (outcome.kind === 'discard') return outcome;

  /* ── 자동 반영 ── */
  // ⚠️ 이미 잠긴 현장은 건드리지 않는다. 사람이 손으로 정한 단계를 공시가 덮으면 안 된다.
  const { data: current } = await admin
    .from('apt_sites').select('lifecycle_stage, stage_locked').eq('id', outcome.siteId).maybeSingle();
  if (current?.stage_locked) {
    return { kind: 'auto', slug: outcome.siteSlug, changed: false };
  }

  const changed = current?.lifecycle_stage !== TARGET_STAGE;
  const { error: updErr } = await admin.from('apt_sites').update({
    lifecycle_stage: TARGET_STAGE,
    stage_source: 'dart',
    confidence: 'confirmed',
    confidence_note: `DART ${f.report_nm.trim()} — ${f.corp_name}`,
    updated_at: new Date().toISOString(),
  }).eq('id', outcome.siteId);
  if (updErr) {
    console.warn(`[dart/redev] 반영 실패 (${f.rcept_no}): ${updErr.message}`);
    await enqueue(admin, f, { kind: 'queue', reason: `update_failed:${updErr.message}`, zones });
    return { kind: 'queue', reason: 'update_failed' };
  }

  if (changed) {
    // 트리거(BEFORE UPDATE)가 stage_change 이벤트를 만든다. 여기서는 출처만 얹는다 —
    // 트리거가 confidence·source 는 옮기지만 source_url·note 는 옮기지 않는다.
    const { data: ev } = await admin
      .from('apt_site_events').select('id')
      .eq('site_id', outcome.siteId).eq('event_type', 'stage_change')
      .order('occurred_at', { ascending: false }).limit(1).maybeSingle();
    if (ev?.id) {
      await admin.from('apt_site_events').update({
        source_url: dartUrl(f.rcept_no),
        note: `${outcome.zone} 시공사 선정 — ${f.corp_name}`,
      }).eq('id', ev.id);
    }
    await pingIndexNow(admin, outcome.siteSlug);
  }

  return { kind: 'auto', slug: outcome.siteSlug, changed };
}

/** 즉시 색인 핑. 제출은 indexnow-urgent(5분)이 맡는다. */
async function pingIndexNow(admin: any, slug: string) {
  try {
    const url = `https://kadeora.app/apt/${slug}`;
    const { data: dup } = await admin
      .from('indexnow_queue').select('id').eq('url', url).eq('status', 'pending').maybeSingle();
    if (dup) return;
    await admin.from('indexnow_queue').insert({
      url, priority: 1, is_urgent: true, source: 'dart_redev', status: 'pending',
    });
  } catch (e: any) {
    console.error('[dart/redev] indexnow enqueue failed:', e?.message ?? String(e));
  }
}
