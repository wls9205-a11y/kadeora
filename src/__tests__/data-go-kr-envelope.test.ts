// D5-1 자물쇠 — 「거절」과 「거래 없는 달」을 가르는 판정.
//
// 이 판정이 조용히 틀리면 «관측 자체가 거짓» 이 된다. 경남이 3개월간 아무도 모르게
// 죽어 있던 것도 정확히 이 구분이 없어서였다. 그래서 표본을 실물로 박아 둔다.
//
// ⚠️ 아래 정상 응답 XML 은 **실제 호출 결과**다 (2026-08-26, 부산 해운대구 202608).
//    resultCode 가 `00` 이 아니라 **`000`** 이다. 지시서 초안에는 `00` 으로 적혀 있었다.

import { describe, it, expect } from 'vitest';
import { readEnvelope } from '@/lib/cron/data-go-kr-envelope';

const OK_WITH_ITEMS =
  '<?xml version="1.0" encoding="utf-8" standalone="yes"?><response><header>' +
  '<resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>' +
  '<item><aptNm>해운대두산위브더제니스</aptNm><dealAmount>120,000</dealAmount></item>' +
  '</items><numOfRows>1000</numOfRows><totalCount>148</totalCount></body></response>';

// 실제 호출 결과 (2026-08-26, 광주 서구 202608) — 거래가 «없는» 달이다.
const OK_NO_ITEMS =
  '<?xml version="1.0" encoding="utf-8" standalone="yes"?><response><header>' +
  '<resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items/>' +
  '<numOfRows>1000</numOfRows><totalCount>0</totalCount></body></response>';

const LIMIT_EXCEEDED =
  '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>' +
  '<returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>' +
  '<returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';

const KEY_NOT_REGISTERED =
  '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>' +
  '<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>' +
  '<returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';

const BUSINESS_ERROR =
  '<response><header><resultCode>99</resultCode>' +
  '<resultMsg>INVALID REQUEST PARAMETER ERROR</resultMsg></header></response>';

describe('readEnvelope — 정상', () => {
  it('resultCode 000 은 정상이다 (00 이 아니다 — 실측)', () => {
    expect(readEnvelope(OK_WITH_ITEMS)).toEqual({ ok: true, code: '000', msg: 'OK' });
  });

  it('**item 0개여도 resultCode 가 정상이면 정상이다** — 거래 없는 달', () => {
    const e = readEnvelope(OK_NO_ITEMS);
    expect(e.ok).toBe(true);
    expect(e.code).toBe('000');
  });
});

describe('readEnvelope — 거절', () => {
  it('한도 초과(22)를 잡는다 — D5-2 의 유력 후보', () => {
    const e = readEnvelope(LIMIT_EXCEEDED);
    expect(e.ok).toBe(false);
    expect(e.code).toBe('22');
    expect(e.msg).toContain('LIMITED_NUMBER_OF_SERVICE_REQUESTS');
  });

  it('키 미등록(30)을 잡는다', () => {
    const e = readEnvelope(KEY_NOT_REGISTERED);
    expect(e.ok).toBe(false);
    expect(e.code).toBe('30');
  });

  it('업무 오류 resultCode 도 거절로 센다', () => {
    const e = readEnvelope(BUSINESS_ERROR);
    expect(e.ok).toBe(false);
    expect(e.code).toBe('99');
  });

  it('코드가 아예 없으면 정상으로 세지 않는다 — 점검 HTML 등', () => {
    const e = readEnvelope('<html><body>서비스 점검 중입니다</body></html>');
    expect(e.ok).toBe(false);
    expect(e.code).toBe('NO_CODE');
  });
});

describe('정규식 회귀 — new RegExp escape 사고', () => {
  it('본문에 개행·태그가 섞여도 헤더만 정확히 뽑는다', () => {
    const xml = '<response>\n  <header>\n    <resultCode>000</resultCode>\n' +
      '    <resultMsg>OK</resultMsg>\n  </header>\n  <body><items><item><umdNm>우동</umdNm></item></items></body>\n</response>';
    expect(readEnvelope(xml)).toEqual({ ok: true, code: '000', msg: 'OK' });
  });
});
