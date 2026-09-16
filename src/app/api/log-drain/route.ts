/**
 * K-10 ① — Vercel Log Drain 수신구 (2026-09-16).
 *
 * 이 라우트가 존재하는 이유는 「봇이 우리 문을 두드렸을 때 무엇을 받았나」를 잴 자가
 * 하나도 없었기 때문이다. 다른 네 경로는 실측으로 부결됐다:
 *   · page_views — 클라이언트 JS 비콘이라 JS 안 도는 봇은 애초에 안 잡힌다
 *   · Vercel 런타임 로그 API — UA 가 실리지 않는다(Googlebot 전문검색 0건)
 *   · 서버 컴포넌트 headers() — 정적 렌더를 포기하게 된다. 39,673 페이지가 전부 동적이 된다
 *   · 미들웨어 DB 쓰기 — 이미 포화된 큐에 부하를 얹는다(재려는 대상을 악화시킨다)
 * Drain 만 UA·status·path 를 «핫패스 비용 0» 으로 준다.
 *
 * ⛔ 이 표는 계기지 로그 보관소가 아니다. 봇 행만 남기고 사람은 «수신 즉시» 버린다.
 * ⛔ 본문(message)은 적재하지 않는다 — 크기도 크고 개인정보가 섞일 수 있다.
 *
 * 설정 순서: ① 이 라우트 배포 → ② Vercel 대시보드 Settings → Log Drains 에서
 *   엔드포인트 등록(형식 JSON/NDJSON) → ③ 시크릿을 LOG_DRAIN_SECRET 에 넣는다.
 *   Vercel 은 등록 시 «검증 요청» 을 보내고 응답 헤더 x-vercel-verify 를 확인한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { classifyBot } from '@/lib/bot-classify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SECRET = process.env.LOG_DRAIN_SECRET || '';
/** Vercel 이 Drain 등록 때 확인하는 소유 증명 값. 대시보드가 알려 준다. */
const VERIFY = process.env.VERCEL_LOG_DRAIN_VERIFY || '';
/** 한 번에 받을 수 있는 최대 줄 수. Drain 배치가 이보다 크면 잘라 담는다. */
const MAX_LINES = 2000;

function verifyHeader() {
  return VERIFY ? { 'x-vercel-verify': VERIFY } : undefined;
}

/** Drain 등록 검증(GET)과 헬스체크. 본문은 주지 않는다. */
export async function GET() {
  return new NextResponse(null, { status: 200, headers: verifyHeader() });
}

/**
 * ⚠️ 서명은 «원문 바이트» 로 검증한다. JSON.parse 한 뒤 다시 stringify 하면
 *    공백·키 순서가 달라져 «항상 불일치» 한다 — 서명 검증이 조용히 죽는 흔한 자리다.
 */
function signatureOk(raw: string, header: string | null): boolean {
  if (!SECRET) return false;
  if (!header) return false;
  const expected = crypto.createHmac('sha1', SECRET).update(raw).digest('hex');
  const got = header.replace(/^sha1=/, '');
  // 길이가 다르면 timingSafeEqual 이 던진다. 먼저 막는다.
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Drain 은 JSON 배열로도, NDJSON(줄마다 한 객체)으로도 온다. 둘 다 받는다. */
function parseBody(raw: string): any[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try { const a = JSON.parse(trimmed); return Array.isArray(a) ? a : []; } catch { return []; }
  }
  const out: any[] = [];
  for (const line of trimmed.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* 한 줄이 깨져도 나머지는 살린다 */ }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 검증 요청은 본문이 비어 있다. 200 + verify 헤더만 돌려준다.
  if (!raw.trim()) {
    return new NextResponse(null, { status: 200, headers: verifyHeader() });
  }
  const sig = req.headers.get('x-vercel-signature');

  // ⚠️ 서명이 «아예 없는» 요청과 «틀린» 요청을 가른다 (2026-09-16 · Drain Test 401 사후).
  //   대시보드의 Test 버튼은 서명 없이 쏘기 때문에, 없는 것까지 401 로 막으면
  //   Node 가 설정을 확인할 방법이 사라지고 — 더 나쁘게는 Vercel 이 «반복 401 을 보고
  //   Drain 을 비활성화» 할 수 있다. 계기가 스스로 꺼지는 사고다.
  //   그래서 서명 없는 요청은 200 을 주되 «한 줄도 적재하지 않는다». 주입 위험은 0 이고,
  //   응답 본문의 note 가 「시크릿이 안 붙었다」는 사실을 그대로 말해 준다.
  // ⛔ 서명이 «붙어 있는데 틀린» 것은 위조 시도다. 그건 그대로 401.
  if (!sig) {
    return NextResponse.json(
      { ok: true, stored: 0, note: 'unsigned — 저장하지 않음. Drain 에 시크릿이 설정됐는지 확인할 것' },
      { headers: verifyHeader() },
    );
  }
  if (!signatureOk(raw, sig)) {
    // ⛔ 이유를 자세히 적지 않는다. 공개 엔드포인트다.
    return NextResponse.json({ ok: false }, { status: 401, headers: verifyHeader() });
  }

  const lines = parseBody(raw).slice(0, MAX_LINES);
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let sawUa = 0;

  for (const e of lines) {
    const proxy = (e?.proxy ?? {}) as Record<string, any>;
    // ⚠️ UA 가 어느 칸에 오는지는 Drain 소스(edge/serverless/external)마다 다르다.
    //    한 곳만 보다가 «전 행이 human 으로 걸러져 0건» 이 되는 사고를 실제로 겪었다.
    //    후보를 넓게 보되 «찾은 적이 있는지»(sawUa)를 세어, 0건일 때 원인을 가를 수 있게 한다.
    const uaRaw =
      proxy.userAgent ?? proxy.user_agent ?? proxy['user-agent'] ??
      e?.userAgent ?? e?.user_agent ??
      (e?.requestHeaders ?? e?.headers ?? {})['user-agent'] ?? null;
    // ⛔ 되먹임 고리 차단 (2026-09-16 실측 사고).
    //    Drain 이 배달한 로그를 처리하면서 우리가 로그를 남기면, 그 로그가 «새 이벤트» 가 되어
    //    다시 배달된다. 실제로 초당 여러 번 재귀했다(received=1 이 끝없이 반복).
    //    자기 경로는 «세지도 말고 적재하지도 않는다». 계기가 스스로를 관측하면 안 된다.
    const rawPath = String(proxy.path ?? e?.path ?? '');
    if (rawPath.startsWith('/api/log-drain')) continue;

    const ua: string | null = Array.isArray(uaRaw) ? uaRaw[0] : uaRaw;
    if (ua) sawUa++;
    const bot = classifyBot(ua);
    // ⛔ 사람은 버린다. 이 표는 봇 계기다.
    if (bot === 'human') continue;

    const requestId: string | null = e?.requestId ?? proxy.requestId ?? null;
    // 같은 배치 안의 중복도 막는다(DB 유니크 인덱스는 배치 간 중복을 막는다).
    if (requestId) {
      if (seen.has(requestId)) continue;
      seen.add(requestId);
    }
    const ts = Number(proxy.timestamp ?? e?.timestamp);
    rows.push({
      occurred_at: Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString(),
      bot,
      status: Number(proxy.statusCode ?? e?.statusCode) || null,
      path: String(proxy.path ?? e?.path ?? '').slice(0, 512) || null,
      host: String(proxy.host ?? e?.host ?? '').slice(0, 128) || null,
      region: String(proxy.region ?? e?.region ?? '').slice(0, 32) || null,
      cache: String(proxy.cacheId ? 'HIT' : (proxy.cache ?? '')).slice(0, 16) || null,
      ua: ua?.slice(0, 300) ?? null,
      request_id: requestId,
    });
  }

  // 진단 1줄 — 「받았는데 왜 0건인가」를 가르는 자.
  //   received>0 · sawUa=0 이면 «UA 칸을 못 찾은 것»(소스 설정 또는 필드명 문제)
  //   sawUa>0  · stored=0 이면 «전부 사람»(정상. 봇이 아직 안 왔다)
  // ⚠️ 표본 키만 찍는다. 본문·IP·UA 값은 로그에 남기지 않는다.
  // ⛔ 여기서 console.log 를 하면 그 줄이 «새 드레인 이벤트» 가 되어 다시 돌아온다.
  //    진단이 필요하면 1% 표본만, 그리고 자기 경로를 이미 걸러낸 뒤에만 찍는다.
  //    (첫 판에 무조건 찍었다가 초당 여러 번 재귀했다 — 계기가 스스로를 관측한 사고다.)
  if (lines.length && !rows.length && sawUa === 0 && Math.random() < 0.01) {
    const s = lines[0] ?? {};
    console.log('[log-drain] received=%d sawUa=0 stored=0 proxyKeys=%s',
      lines.length, Object.keys((s as any).proxy ?? {}).slice(0, 12).join('|'));
  }

  if (rows.length) {
    try {
      // ⚠️ 중복은 «조용히» 무시한다. Drain 은 재전송을 하고, 재전송 때문에 500 을 주면
      //    Vercel 이 Drain 을 비활성화할 수 있다 — 계기가 스스로 꺼지는 사고를 막는다.
      await (getSupabaseAdmin() as any)
        .from('bot_hits')
        .upsert(rows, { onConflict: 'request_id', ignoreDuplicates: true });
    } catch {
      // 적재 실패로 200 을 깨지 않는다. 같은 이유다.
    }
  }

  return NextResponse.json(
    { ok: true, received: lines.length, stored: rows.length },
    { headers: verifyHeader() },
  );
}
