import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP 위반 수집 — Report-Only 전용. 2026-09-07 신설.
 *
 * ⛔ 이 라우트는 «아무것도 차단하지 않는다». 브라우저가 보내 오는 보고를 로그로만 남긴다.
 *    집행 정책(Content-Security-Policy)은 middleware.ts 의 CSP_PARTS 그대로이고,
 *    여기 들어오는 것은 전부 Content-Security-Policy-Report-Only 초안에 걸린 것이다.
 *
 * ⚠️ 보고는 «브라우저가» 보낸다 — 우리 코드가 부르는 게 아니다. 그래서:
 *    · 인증을 걸 수 없다(브라우저는 쿠키·헤더를 실어 주지 않는다). 공개 엔드포인트다.
 *    · 아무나 아무 JSON 이나 POST 할 수 있다. 여기 들어온 내용은 «신뢰하지 않는다» —
 *      로그로만 쓰고, 값으로 분기하거나 DB 에 넣지 않는다.
 *    · 광고·확장프로그램이 만드는 잡음이 많다. 그 «양» 도 판독 재료다.
 *
 * ⚠️ 폭주 방지 — CSP 보고는 한 페이지에서 수십 건이 한꺼번에 온다.
 *    인스턴스당 상한을 두고, 넘으면 세지기만 하고 찍지 않는다.
 *    ⛔ 로그가 곧 비용이다. 「전부 남기면 언젠가 읽겠지」로 두지 않는다.
 *
 * 규격이 둘이다:
 *   · report-uri  → Content-Type: application/csp-report, 본문 { "csp-report": {...} }
 *   · report-to   → Content-Type: application/reports+json, 본문 [ { type, body: {...} } ]
 *   둘 다 받는다.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/** 인스턴스당 상한. 넘으면 카운트만 올린다. */
const MAX_LOGGED = 200;
let logged = 0;
let dropped = 0;
/** 아는 형태가 아닌 본문을 원문으로 남기는 상한 — 진단용이라 훨씬 낮게 잡는다. */
const MAX_UNPARSED = 20;
let unparsed = 0;

type Violation = {
  directive?: string;
  blocked?: string;
  doc?: string;
  sample?: string;
};

function normalize(payload: unknown): Violation[] {
  const out: Violation[] = [];

  // report-uri 형식
  const single = (payload as { 'csp-report'?: Record<string, unknown> })?.['csp-report'];
  if (single && typeof single === 'object') {
    out.push({
      directive: String(single['effective-directive'] ?? single['violated-directive'] ?? ''),
      blocked: String(single['blocked-uri'] ?? ''),
      doc: String(single['document-uri'] ?? ''),
      sample: String(single['script-sample'] ?? ''),
    });
  }

  // report-to 형식
  if (Array.isArray(payload)) {
    for (const r of payload) {
      const b = (r as { body?: Record<string, unknown> })?.body;
      if (!b || typeof b !== 'object') continue;
      out.push({
        directive: String(b['effectiveDirective'] ?? b['violatedDirective'] ?? ''),
        blocked: String(b['blockedURL'] ?? b['blockedURI'] ?? ''),
        doc: String(b['documentURL'] ?? b['documentURI'] ?? ''),
        sample: String(b['sample'] ?? ''),
      });
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  // ⚠️ 어떤 이유로도 여기서 예외를 밖으로 내지 않는다. 보고 수집이 사용자 요청을
  //    깨뜨리는 일은 없어야 한다 — 항상 204 로 닫는다.
  try {
    const raw = await req.text();
    // 본문 상한 — 8KB 넘는 보고는 잘라서 본다.
    const body = raw.length > 8192 ? raw.slice(0, 8192) : raw;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }

    const items = parsed ? normalize(parsed) : [];

    // ⚠️ 자가진단 — 본문은 왔는데 «아는 형태가 아니면» 원문을 잘라서 한 번 남긴다.
    //    2026-09-07 실측: 실제 브라우저가 보낸 POST 가 204 를 받고도 보고 줄을 남기지
    //    않았다(위 두 분기에 안 걸렸다). 이게 없으면 1주 수집이 «빈손인데 왜 빈손인지
    //    모르는» 상태로 끝난다. 상한을 따로 두어 잡음이 로그를 먹지 않게 한다.
    if (items.length === 0 && body.trim().length > 0 && unparsed < MAX_UNPARSED) {
      unparsed++;
      console.warn('[CSP_REPORT_UNPARSED]', JSON.stringify({
        ct: req.headers.get('content-type')?.slice(0, 60),
        len: raw.length,
        head: body.slice(0, 400),
        n: unparsed,
      }));
    }

    for (const v of items) {
      if (logged >= MAX_LOGGED) {
        dropped++;
        continue;
      }
      logged++;
      // no-console 규칙은 warn/error 를 허용한다. 이건 경고 성격이 맞다.
      console.warn('[CSP_REPORT_ONLY]', JSON.stringify({
        directive: v.directive?.slice(0, 60),
        blocked: v.blocked?.slice(0, 200),
        doc: v.doc?.slice(0, 200),
        sample: v.sample?.slice(0, 120),
        n: logged,
        dropped,
      }));
    }
  } catch {
    // 삼킨다 — 위 주석대로.
  }

  return new NextResponse(null, { status: 204 });
}

/** GET 은 수집 대상이 아니다. 존재만 알리고 끝낸다(디버깅용). */
export async function GET() {
  return NextResponse.json(
    { ok: true, mode: 'report-only', logged, dropped, unparsed, max: MAX_LOGGED },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
