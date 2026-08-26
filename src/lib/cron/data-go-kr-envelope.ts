// data.go.kr 응답 «봉투» 판독 — D5-1 (2026-08-26).
//
// 크론 라우트 파일에서 뺀 이유는 두 가지다.
//   1. Next.js App Router 의 route.ts 는 정해진 것 외에 export 를 허용하지 않는다
//      (TS2344 — 실제로 걸렸다). 테스트하려면 밖으로 나와야 한다.
//   2. 「이 응답이 거절인가」 판정은 조용히 틀리면 «관측 자체가 거짓» 이 된다.
//      그래서 테스트로 잠근다 (src/__tests__/data-go-kr-envelope.test.ts).
//
// 왜 필요한가: 공공데이터포털이 에러 XML 을 보내도 `<item>` 이 없으므로 본문 파서는 `[]` 를 낸다.
// `[]` 는 「거래 없는 달」과 구분되지 않는다. 그 둘을 가르는 것이 이 파일의 존재 이유다.

/**
 * D5-1 — 응답 «봉투» 판독. 본문(`<item>`) 파싱과 분리한다.
 *
 * ⚠️ 정규식을 `new RegExp(...)` 로 만들지 않는다. 리터럴만 쓴다.
 *    템플릿 문자열 안에서 백슬래시가 한 겹 벗겨져 `[\s\S]` 가 `[sS]` 로 굳는 사고를
 *    이 작업 중에 실제로 재현했다. 헤더 판독은 조용히 틀리면 관측 자체가 거짓이 된다.
 *
 * 두 가지 봉투를 다 읽는다:
 *   정상/업무오류  <response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg>
 *   게이트웨이오류 <OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>22</returnReasonCode>
 *                  <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
 */
const RE_RESULT_CODE = /<resultCode>([^<]*)<\/resultCode>/;
const RE_RESULT_MSG = /<resultMsg>([^<]*)<\/resultMsg>/;
const RE_REASON_CODE = /<returnReasonCode>([^<]*)<\/returnReasonCode>/;
const RE_AUTH_MSG = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/;
const RE_ERR_MSG = /<errMsg>([^<]*)<\/errMsg>/;

/**
 * 정상 코드. **실측: 이 API 는 `000` 을 준다** (`00` 이 아니다).
 * 다른 표기로 바뀔 때를 대비해 동의어를 같이 둔다 — 정상을 실패로 세면 관측이 쓰레기가 된다.
 */
const OK_CODES = new Set(['00', '000', '0']);

export interface EnvelopeInfo {
  /** 업무적으로 «정상 응답» 인가. items 0개여도 정상일 수 있다(거래 없는 달). */
  ok: boolean;
  /** 집계 키. 코드가 없으면 'NO_CODE'. */
  code: string;
  msg: string;
}

export function readEnvelope(xml: string): EnvelopeInfo {
  const reason = xml.match(RE_REASON_CODE)?.[1]?.trim();
  if (reason && !OK_CODES.has(reason)) {
    const msg = xml.match(RE_AUTH_MSG)?.[1]?.trim() || xml.match(RE_ERR_MSG)?.[1]?.trim() || '';
    return { ok: false, code: reason, msg };
  }
  const result = xml.match(RE_RESULT_CODE)?.[1]?.trim();
  if (result != null && result !== '') {
    const msg = xml.match(RE_RESULT_MSG)?.[1]?.trim() || '';
    return { ok: OK_CODES.has(result), code: result, msg };
  }
  if (reason) return { ok: true, code: reason, msg: '' };
  // 코드가 어디에도 없다 — XML 이 아닐 수 있다(HTML 점검 페이지 등). 정상으로 세지 않는다.
  return { ok: false, code: 'NO_CODE', msg: xml.slice(0, 80).replace(/\s+/g, ' ') };
}

