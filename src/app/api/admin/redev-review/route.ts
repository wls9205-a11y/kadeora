/**
 * ADDENDUM §2 — DART 정비사업 검수 큐.
 *
 * 자동 반영이 확신하지 못한 공시를 사람이 3초에 한 건 판정한다.
 *
 *   GET  ?status=pending|rejected|approved&limit=
 *        큐 목록 + 각 행의 구역명 후보로 찾은 **실존 현장 후보**를 함께 내려준다.
 *        후보를 서버에서 붙이는 이유: 화면이 매칭 규칙을 또 구현하면 규칙이 두 벌이 된다.
 *
 *   POST { id, action: 'approve' | 'reject', site_id?, note? }
 *        approve → applyConstructorSelected() 로 반영. **크론과 같은 함수를 쓴다.**
 *        reject  → 큐만 닫는다. 현장은 건드리지 않는다.
 *
 * ── 시간 축 (⚠️ 화면이 잘못 읽기 쉬운 부분) ──
 *   주축  created_at(우리가 수집한 시각) → resolved_at(사람이 처리한 시각)
 *   참고  filed_at — DART rcept_dt 는 **날짜만** 준다(항상 00:00). 분 단위를 못 잰다.
 *   「공시 → 노출 30분」 목표는 주축으로만 실측된다. filed_at 으로 재면 항상 몇 시간이 나온다.
 *
 * ⚠️ 인증: 미들웨어는 /api/admin 을 보호하지 않는다. 이 라우트가 직접 requireAdmin() 을 부른다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  REVIEW_TABLE,
  CLOSED_STATUS,
  TARGET_STAGE,
  applyConstructorSelected,
  candidatesForZone,
} from '@/lib/dart/redev-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DB CHECK 와 같은 목록. 목록 밖 값을 쓰면 23514 로 조용히 죽는다 — 오늘 그걸로 반나절 썼다. */
const ALLOWED_STATUS = new Set(['pending', 'approved', 'rejected']);

const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') ?? 'pending';
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'BAD_STATUS', allowed: [...ALLOWED_STATUS] }, { status: 400 });
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit') ?? 30) || 30));

  const { data: rows, error } = await admin
    .from(REVIEW_TABLE)
    .select('id, rcept_no, corp_name, report_nm, source_url, filed_at, zone_candidates, reason, proposed_stage, status, resolved_site_id, reviewed_by, note, resolved_at, created_at')
    // pending 은 오래된 것부터(먼저 들어온 걸 먼저 본다), 처리분은 최근 것부터.
    .order('created_at', { ascending: status === 'pending' })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 상태별 건수 — 탭에 숫자를 띄운다. 0건이어도 탭이 보여야 이력을 열 수 있다.
  const counts: Record<string, number> = {};
  for (const s of ALLOWED_STATUS) {
    const { count } = await admin
      .from(REVIEW_TABLE).select('id', { count: 'exact', head: true }).eq('status', s);
    counts[s] = count ?? 0;
  }

  // 구역명 후보 → 실존 현장. pending 만 붙인다(처리분은 이미 resolved_site_id 가 있다).
  const items = [] as any[];
  for (const r of rows ?? []) {
    let siteOptions: any[] = [];
    if (status === 'pending') {
      const zones: string[] = Array.isArray(r.zone_candidates) ? r.zone_candidates.filter((z: any) => typeof z === 'string') : [];
      const seen = new Set<string>();
      for (const z of zones.slice(0, 5)) {
        for (const c of await candidatesForZone(admin, z)) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          siteOptions.push({ id: c.id, slug: c.slug, name: c.name, builder: c.builder, zone: z });
        }
      }
    }

    let resolvedSite: any = null;
    if (r.resolved_site_id) {
      const { data: s } = await admin
        .from('apt_sites').select('slug, name, lifecycle_stage').eq('id', r.resolved_site_id).maybeSingle();
      resolvedSite = s ?? null;
    }

    items.push({ ...r, site_options: siteOptions, resolved_site: resolvedSite });
  }

  return NextResponse.json({ ok: true, status, counts, items, target_stage: TARGET_STAGE });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin as any;
  const reviewer = auth.user.id;

  const body = await req.json().catch(() => ({} as any));
  const id = Number(body?.id);
  const action = String(body?.action ?? '');
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : null;

  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'BAD_ACTION' }, { status: 400 });
  }

  const { data: row } = await admin
    .from(REVIEW_TABLE)
    .select('id, rcept_no, corp_name, report_nm, filed_at, zone_candidates, status')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (row.status !== 'pending') {
    // 두 사람이 같은 건을 눌렀을 때 두 번 반영되지 않게 한다.
    return NextResponse.json({ error: 'ALREADY_RESOLVED', status: row.status }, { status: 409 });
  }

  /* ── 반려 — 큐만 닫는다 ── */
  if (action === 'reject') {
    const { data, error } = await admin
      .from(REVIEW_TABLE)
      .update({
        status: CLOSED_STATUS,
        reviewed_by: reviewer,
        resolved_at: new Date().toISOString(),
        note,
      })
      .eq('id', id).eq('status', 'pending')
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // ⚠️ 영향 행 수를 확인한다. 0건이면 "처리했다" 고 답하지 않는다.
    if ((data?.length ?? 0) === 0) return NextResponse.json({ error: 'NO_ROW_UPDATED' }, { status: 409 });
    return NextResponse.json({ ok: true, action, id });
  }

  /* ── 승인 — 현장에 반영 ── */
  const siteId = typeof body?.site_id === 'string' ? body.site_id : '';
  if (!siteId) return NextResponse.json({ error: 'SITE_ID_REQUIRED' }, { status: 400 });

  const { data: site } = await admin
    .from('apt_sites').select('id, slug, name').eq('id', siteId).eq('is_active', true).maybeSingle();
  if (!site) return NextResponse.json({ error: 'SITE_NOT_FOUND' }, { status: 404 });

  const zones: string[] = Array.isArray(row.zone_candidates) ? row.zone_candidates.filter((z: any) => typeof z === 'string') : [];

  // ⚠️ 크론과 같은 함수다. 사람이 누른 승인과 자동 반영이 다른 값을 쓰면 안 된다.
  const applied = await applyConstructorSelected(admin, {
    siteId: site.id,
    siteSlug: site.slug,
    zone: zones[0] ?? site.name,
    filing: {
      rcept_no: row.rcept_no,
      corp_name: row.corp_name ?? '',
      report_nm: row.report_nm ?? '',
      filed_at: row.filed_at ?? null,
    },
  });
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 500 });

  const { data, error } = await admin
    .from(REVIEW_TABLE)
    .update({
      status: 'approved',
      resolved_site_id: site.id,
      reviewed_by: reviewer,
      resolved_at: new Date().toISOString(),
      note,
    })
    .eq('id', id).eq('status', 'pending')
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((data?.length ?? 0) === 0) return NextResponse.json({ error: 'NO_ROW_UPDATED' }, { status: 409 });

  return NextResponse.json({
    ok: true,
    action,
    id,
    slug: site.slug,
    changed: applied.changed,
    // 잠긴 현장이면 단계를 안 바꾼다. 화면이 "반영됨" 으로 잘못 안내하지 않게 그대로 알린다.
    locked: applied.locked ?? false,
  });
}
