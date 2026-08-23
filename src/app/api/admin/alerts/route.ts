/**
 * [S10-2] 어드민 경보함 API — admin_alerts
 *
 * GET   : 목록 + 레벨별 살아있는 건수
 *         ?archived=0|1 (기본 0 = 살아있음) · ?severity=critical|warning|info · ?limit= (기본 50, 최대 200)
 * PATCH : { id } 또는 { all: true } → archived = true, archived_at = now()
 *
 * ⚠️ is_read 를 쓰지 말 것. 1,009건 전량 미읽음이라 정보량이 0이다.
 *    트리아지 신호는 archived 이고, 아카이브 크론 2개가 14일 경과분을 자동으로 넘긴다.
 * ⚠️ INSERT / DELETE 를 열지 않는다. 경보 생성자는 DB 함수 2개 + cron-logger 뿐이다.
 *
 * 구조는 api/admin/notifications/route.ts 를 따랐다 (검증된 같은 모양).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { SEVERITY_RAW, NON_INFO_RAW, isAlertLevel } from '@/lib/admin/alert-severity';

const TABLE = 'admin_alerts';
const COLS = 'id, type, severity, title, message, metadata, archived, archived_at, created_at';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const url = new URL(req.url);
  const archived = url.searchParams.get('archived') === '1';
  const severityParam = url.searchParams.get('severity');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);

  let q = (admin as any).from(TABLE)
    .select(COLS)
    .eq('archived', archived)
    .order('created_at', { ascending: false })
    .limit(limit);

  // 정규화 레벨로 받아 DB 원본 값으로 펼친다. info 는 catch-all 이라 여집합으로 건다 —
  // 목록으로 걸면 나중에 새 어휘가 생겼을 때 조용히 빠진다.
  if (isAlertLevel(severityParam)) {
    q = severityParam === 'info'
      ? q.not('severity', 'in', `(${NON_INFO_RAW.join(',')})`)
      : q.in('severity', SEVERITY_RAW[severityParam]);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 살아있는 건수는 필터와 무관하게 항상 같은 값을 준다 (헤더 배지가 이 값을 쓴다).
  const liveBase = () => (admin as any).from(TABLE).select('id', { count: 'exact', head: true }).eq('archived', false);
  const [liveTotal, liveCritical, liveWarning] = await Promise.all([
    liveBase(),
    liveBase().in('severity', SEVERITY_RAW.critical),
    liveBase().in('severity', SEVERITY_RAW.warning),
  ]);

  const total = liveTotal.count || 0;
  const critical = liveCritical.count || 0;
  const warning = liveWarning.count || 0;

  return NextResponse.json({
    ok: true,
    rows: data || [],
    live_by_severity: {
      total,
      critical,
      warning,
      // 여집합으로 계산한다 — info·low 목록을 세면 미지의 어휘가 어디에도 안 잡힌다.
      info: Math.max(total - critical - warning, 0),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const body = await req.json().catch(() => ({}));
  const patch = { archived: true, archived_at: new Date().toISOString() };

  if (body?.all === true) {
    // 살아있는 것만 넘긴다. 이미 아카이브된 행의 archived_at 을 덮어쓰지 않는다.
    const { error, count } = await (admin as any).from(TABLE)
      .update(patch, { count: 'exact' })
      .eq('archived', false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mode: 'all', archived_count: count ?? 0 });
  }

  const id = typeof body?.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await (admin as any).from(TABLE).update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
