/**
 * V16 D — 어드민 한 줄 입력 (현장 단계·메모).
 *
 * Node 가 남보다 빠른 이유는 크롤러가 아니라 사람이다. 총회장에서 듣는 정보가
 * 들어올 문이 지금까지 없었다. 모바일 30초: 현장 검색 → 단계 → 한 줄 메모 → 등급 → 저장.
 *
 *   GET  ?q=            현장 검색 (name / slug 부분 일치). 현재 단계·등급 포함
 *   POST { ... }        기존 현장 단계 갱신 **또는** 없는 현장 즉석 생성
 *
 * ── 인증 (v8-C /api/admin/apt-cover 패턴 그대로) ──
 *   세션(requireAdmin) **또는** 머신 토큰(verifyCronAuth).
 *   머신 토큰 판정은 lib/cron-auth.ts 의 verifyCronAuth 하나만 쓴다 —
 *   토큰 검사를 여기서 다시 구현하면 규칙이 두 벌이 되고 한쪽만 고치게 된다.
 *
 * ── 머신 토큰 경로의 제약 3가지 ──
 *   ① stage_locked 강제 false — 세션 생성만 true 를 걸 수 있다.
 *      크론(fn_refresh_lifecycle_stage)이 교정할 여지를 남긴다.
 *   ② confidence 기본 estimated — confirmed 는 세션 전용이다.
 *      고시·공시 원문을 봤다는 판단은 사람이 한다.
 *   ③ 하루 생성 상한 MACHINE_DAILY_CREATE_CAP 건. 초과 시 429.
 *      pg_net 루프가 어긋났을 때 현장 표를 오염시키지 않게 막는다.
 *
 * ── 이력 (apt_site_events) ──
 *   ⚠️ 트리거 apt_sites_stage_change 는 **BEFORE UPDATE 전용**이다. INSERT 에는 걸리지 않는다.
 *      그래서 신규 생성만 이 라우트가 직접 이벤트를 남긴다 (갱신은 트리거에 맡긴다).
 *   ⚠️ 트리거는 confidence·source 만 옮기고 note·source_url 은 옮기지 않는다.
 *      메모·출처가 있으면 트리거가 만든 그 행을 뒤이어 채운다 (새 행을 더 만들지 않는다).
 *   ⚠️ 단계가 그대로인데 메모만 남기는 경우는 트리거가 아무것도 만들지 않는다.
 *      그때만 note 이벤트를 하나 넣는다 — 안 그러면 메모가 화면 어디에도 안 나온다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAptSlug } from '@/lib/apt-slug';
import { PIPELINE_STAGES, lifecycleLabel } from '@/lib/apt/lifecycle-label';
import { KR_REGIONS_17 } from '@/lib/region-storage';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Admin = ReturnType<typeof getSupabaseAdmin>;

/**
 * 이 화면이 다루는 단계는 **공고 전 7단계**뿐이다.
 * 청약·입주 단계는 모집공고와 크론이 정한다 — 사람이 손으로 되돌리면 다음 크론이 덮고,
 * 그 사이 화면이 두 번 바뀐다.
 */
const ADMIN_STAGES = [
  ...PIPELINE_STAGES,
  'site_planning',
  'pre_announcement',
] as const;

const CONFIDENCES = ['confirmed', 'estimated', 'rumor'] as const;
type Confidence = (typeof CONFIDENCES)[number];

/** 머신 토큰 경로의 하루 생성 상한. pg_net 루프 폭주 차단선. */
const MACHINE_DAILY_CREATE_CAP = 50;

const SITE_COLS =
  'id, slug, name, region, sigungu, dong, builder, lifecycle_stage, previous_stage, stage_updated_at, stage_source, stage_locked, confidence, confidence_note, supply_units, complex_units, is_active';

/* ────────────────────────────── 인증 ────────────────────────────── */

async function sessionOrMachine(
  req: NextRequest,
): Promise<{ admin: Admin; via: 'session' | 'machine' } | { error: NextResponse }> {
  if (verifyCronAuth(req)) return { admin: getSupabaseAdmin(), via: 'machine' };
  const auth = await requireAdmin();
  // requireAdmin 성공 분기는 `error?: never` 라 'in' 만으로는 undefined 가 남는다.
  if ('error' in auth && auth.error) return { error: auth.error };
  return { admin: (auth as { admin: Admin }).admin, via: 'session' };
}

/* ────────────────────────────── 유틸 ────────────────────────────── */

const clean = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.replace(/[|;'"\\<>]/g, '').trim().slice(0, max) : '';

/** KST 자정(오늘 시작)의 ISO. 하루 상한을 서버 표준시가 아니라 운영 시간대로 센다. */
function kstDayStartISO(now = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

const isStage = (v: unknown): v is (typeof ADMIN_STAGES)[number] =>
  typeof v === 'string' && (ADMIN_STAGES as readonly string[]).includes(v);

/* ────────────────────────────── GET ────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await sessionOrMachine(req);
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const q = clean(req.nextUrl.searchParams.get('q'), 60);
  if (q.length < 2) {
    return NextResponse.json({ ok: true, items: [], reason: 'query_too_short' });
  }

  const { data, error } = await (admin as any)
    .from('apt_sites')
    .select(SITE_COLS)
    .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
    .eq('is_active', true)
    .order('content_score', { ascending: false })
    .limit(12);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    items: (data ?? []).map((r: any) => ({
      ...r,
      stage_label: lifecycleLabel(r.lifecycle_stage),
    })),
  });
}

/* ────────────────────────────── POST ────────────────────────────── */

export async function POST(req: NextRequest) {
  const auth = await sessionOrMachine(req);
  if ('error' in auth) return auth.error;
  const { admin, via } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const slug = clean(body.slug, 120);
  const name = clean(body.name, 120);
  const stage = body.stage;

  if (!isStage(stage)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_stage', allowed: ADMIN_STAGES },
      { status: 400 },
    );
  }

  // ── 등급 ──
  // 머신은 confirmed 를 쓸 수 없다. 조용히 낮추지 않고 거절한다 —
  // 낮춰 저장하면 호출한 쪽은 confirmed 로 들어간 줄 안다.
  let confidence = body.confidence as Confidence | undefined;
  if (confidence !== undefined && !(CONFIDENCES as readonly string[]).includes(confidence)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_confidence', allowed: CONFIDENCES },
      { status: 400 },
    );
  }
  if (via === 'machine') {
    if (confidence === 'confirmed') {
      return NextResponse.json(
        { ok: false, error: 'confirmed_is_session_only' },
        { status: 403 },
      );
    }
    confidence = confidence ?? 'estimated';
  } else if (!confidence) {
    // 세션은 등급 필수다. 기본값을 주면 아무거나 확정으로 흘러간다.
    return NextResponse.json({ ok: false, error: 'confidence_required' }, { status: 400 });
  }

  // ── 잠금 ──
  // 머신은 절대 잠그지 못한다. 잠기면 크론이 교정할 수 없다.
  const stageLocked = via === 'machine' ? false : body.stageLocked !== false;

  const note = clean(body.note, 400);
  const sourceUrl = clean(body.sourceUrl, 500);
  const stageSource = via === 'machine' ? 'admin:machine' : 'admin';

  /* ── 기존 현장 찾기 ── */
  let site: any = null;
  if (slug) {
    const { data } = await (admin as any).from('apt_sites').select(SITE_COLS).eq('slug', slug).maybeSingle();
    site = data ?? null;
    if (!site) return NextResponse.json({ ok: false, error: 'site_not_found', slug }, { status: 404 });
  }

  /* ────────────── 신규 생성 ────────────── */
  if (!site) {
    if (!name) return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 });

    const region = clean(body.region, 20);
    if (!(KR_REGIONS_17 as readonly string[]).includes(region)) {
      return NextResponse.json(
        { ok: false, error: 'region_required', allowed: KR_REGIONS_17 },
        { status: 400 },
      );
    }

    // ③ 머신 하루 생성 상한
    if (via === 'machine') {
      const { count } = await (admin as any)
        .from('apt_sites')
        .select('id', { count: 'exact', head: true })
        .eq('stage_source', 'admin:machine')
        .gte('created_at', kstDayStartISO());
      if ((count ?? 0) >= MACHINE_DAILY_CREATE_CAP) {
        return NextResponse.json(
          { ok: false, error: 'daily_create_cap_reached', cap: MACHINE_DAILY_CREATE_CAP, created: count },
          { status: 429 },
        );
      }
    }

    const newSlug = generateAptSlug(name);
    if (!newSlug) return NextResponse.json({ ok: false, error: 'slug_generation_failed' }, { status: 400 });

    // 같은 slug 가 이미 있으면 만들지 않는다 — 중복 256쌍을 만든 것이 이 경로다.
    const { data: dup } = await (admin as any).from('apt_sites').select('slug').eq('slug', newSlug).maybeSingle();
    if (dup) {
      return NextResponse.json(
        { ok: false, error: 'slug_exists', slug: newSlug, hint: '기존 현장을 slug 로 지정해 갱신하세요' },
        { status: 409 },
      );
    }

    const insert: Record<string, unknown> = {
      slug: newSlug,
      name,
      region,
      sigungu: clean(body.sigungu, 40) || null,
      dong: clean(body.dong, 40) || null,
      builder: clean(body.builder, 60) || null,
      site_type: 'redevelopment',
      lifecycle_stage: stage,
      stage_source: stageSource,
      stage_locked: stageLocked,
      stage_updated_at: new Date().toISOString(),
      confidence,
      confidence_note: note || null,
      is_active: true,
    };

    const { data: created, error: insErr } = await (admin as any)
      .from('apt_sites').insert(insert).select(SITE_COLS).single();
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

    // ⚠️ 트리거는 BEFORE UPDATE 전용이라 INSERT 에는 안 걸린다. 생성 이력은 여기서 남긴다.
    //    이게 없으면 신규 현장의 진행 이력이 0건이라 목록 노출 조건(V16 F)에도 못 든다.
    await (admin as any).from('apt_site_events').insert({
      site_id: created.id,
      site_slug: created.slug,
      event_type: 'stage_change',
      from_value: null,
      to_value: stage,
      confidence,
      source: stageSource,
      source_url: sourceUrl || null,
      note: note || null,
      occurred_at: new Date().toISOString(),
    });

    await pingIndexNow(created.slug);
    return NextResponse.json({ ok: true, created: true, via, site: created });
  }

  /* ────────────── 기존 현장 갱신 ────────────── */
  const stageChanged = site.lifecycle_stage !== stage;

  const patch: Record<string, unknown> = {
    lifecycle_stage: stage,
    stage_source: stageSource,
    stage_locked: stageLocked,
    confidence,
    confidence_note: note || site.confidence_note || null,
    updated_at: new Date().toISOString(),
  };
  // 비어 있을 때만 채운다 — 사람이 넣은 값을 덮지 않는다.
  const builder = clean(body.builder, 60);
  if (builder && !site.builder) patch.builder = builder;

  const { data: updated, error: updErr } = await (admin as any)
    .from('apt_sites').update(patch).eq('id', site.id).select(SITE_COLS).single();
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  if (stageChanged) {
    // 트리거가 방금 만든 stage_change 행에 메모·출처를 얹는다 (행을 더 만들지 않는다).
    if (note || sourceUrl) {
      const { data: ev } = await (admin as any)
        .from('apt_site_events')
        .select('id')
        .eq('site_id', site.id)
        .eq('event_type', 'stage_change')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ev?.id) {
        await (admin as any).from('apt_site_events')
          .update({ note: note || null, source_url: sourceUrl || null })
          .eq('id', ev.id);
      }
    }
  } else if (note) {
    // 단계가 그대로면 트리거가 아무것도 만들지 않는다. 메모만 남길 때가 여기다.
    await (admin as any).from('apt_site_events').insert({
      site_id: site.id,
      site_slug: site.slug,
      event_type: 'note',
      to_value: null,
      confidence,
      source: stageSource,
      source_url: sourceUrl || null,
      note,
      occurred_at: new Date().toISOString(),
    });
  }

  await pingIndexNow(site.slug);
  return NextResponse.json({ ok: true, created: false, via, stageChanged, site: updated });
}

/* ────────────────────────── IndexNow ────────────────────────── */

/**
 * 큐에 넣기만 한다. 제출은 indexnow-urgent 크론(5분)이 맡는다 —
 * 여기서 직접 포털 3곳을 때리면 폼 저장이 그 왕복을 기다린다.
 * ⚠️ UNIQUE (url, status) 가 DEFERRABLE 이라 ON CONFLICT 를 arbiter 로 쓸 수 없다(55000).
 *    중복은 미리 확인해서 거른다.
 */
async function pingIndexNow(slug: string) {
  try {
    const admin = getSupabaseAdmin();
    const url = `https://kadeora.app/apt/${slug}`;
    const { data: dup } = await (admin as any)
      .from('indexnow_queue').select('id').eq('url', url).eq('status', 'pending').maybeSingle();
    if (dup) return;
    await (admin as any).from('indexnow_queue').insert({
      url, priority: 1, is_urgent: true, source: 'admin_apt_stage', status: 'pending',
    });
  } catch (e: any) {
    // 색인 핑 실패가 저장을 되돌리지 않는다.
    console.error('[apt-stage] indexnow enqueue failed:', e?.message ?? String(e));
  }
}
