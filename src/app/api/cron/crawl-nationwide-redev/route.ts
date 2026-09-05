import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

/**
 * ⛔ 퇴역 — 2026-09-05 (PV2-A · Node `!`).
 *
 * ── 왜 지우지 않고 «세워 두나» ──────────────────────────────────────────────
 * 이 크론은 태어나서 한 건도 받은 적이 없다(cron_logs 4회 · created 0).
 * 원인은 파라미터도 키도 아니고 «엔드포인트가 없다» 는 것이었다:
 *
 *   GET apis.data.go.kr/1613000/MntncBizInfoSvc/getMntncBizList
 *   → HTTP 400  errMsg: NO_OPENAPI_SERVICE_ERROR
 *               returnAuthMsg: 해당 오픈API 서비스가 없거나 폐기됨
 *               returnReasonCode: 12
 *
 * 판별자 보정(같은 키·같은 날): 부산의 «살아 있는» 경로
 * `6260000/MaintenanceBusinessStatus1` 은 **403 SERVICE_KEY_IS_NOT_REGISTERED_ERROR**
 * 를 준다. 즉 이 계정에서도 «경로가 있으면 403 · 없으면 400/코드12» 로 갈린다.
 * 키를 3가지 형태로, sigunguCd 를 빼고, XML/JSON 둘 다로 때려도 응답은 동일했다.
 *
 * ⛔ 파일을 지우지 않는 이유: 지우면 다음 사람이 「전국 정비사업 크롤러가 없네」 하고
 *    같은 엔드포인트로 다시 만든다. 그 실패가 이 자리에 «기록으로» 남아 있어야 한다.
 * ⛔ 되살리지 말 것 — 살아 있는 경로를 «먼저» 찾고, 그때는 새 파일로 만든다.
 *    대체 소스는 A-2(시·도 공개 문서)로 간다: 울산 data.go.kr 파일데이터 15055591,
 *    경남은 창원시 정비사업 통합누리집.
 * ⚠️ 울주군(31710) 코드 추가 안건은 «죽은 표에 붙이지 않는다» — A-2 소스의 코드 표로 이관.
 *
 * vercel.json 스케줄 엔트리는 제거했다. 이 라우트는 직접 호출됐을 때
 * «왜 죽었는지» 를 cron_logs 에 한 줄 남기고 즉시 돌아온다.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RETIRED_NOTE =
  'retired: NO_OPENAPI_SERVICE_ERROR (1613000/MntncBizInfoSvc, 2026-09-05 판정)';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    await (getSupabaseAdmin() as any).from('cron_logs').insert({
      cron_name: 'crawl-nationwide-redev',
      status: 'skipped',
      started_at: new Date().toISOString(),
      metadata: {
        retired_at: '2026-09-05',
        reason: RETIRED_NOTE,
        replacement: 'A-2 공개 문서 소스(울산 data.go.kr 15055591 · 창원시 통합누리집)',
      },
    });
  } catch { /* 기록 실패가 응답을 막지 않는다 */ }
  return NextResponse.json({ ok: true, retired: true, reason: RETIRED_NOTE });
});
