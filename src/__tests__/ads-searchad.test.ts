/**
 * 검색광고 API 서명·판정 (U-3층 ⑤).
 *
 * 이 파일이 지키는 것: «401 을 코드 탓으로 오독하지 않는다».
 * 2026-08-29 첫 실호출에서 403 이 두 종류였다 — Invalid API-KEY(키를 못 찾음)와
 * Invalid Signature(키는 찾았고 서명이 틀림). 그 둘을 같은 칸에 넣으면
 * 전사 오류를 코드 버그로 착각해 엉뚱한 곳을 몇 시간 판다.
 */
import { describe, expect, it } from 'vitest';
import {
  SEARCHAD_BASE,
  classifyStatus,
  describeCred,
  isRetryable,
  kstDate,
  recentDates,
  searchAdHeaders,
  signSearchAd,
  signatureMessage,
  searchAdUrl,
} from '@/lib/ads/searchad';

const CRED = { apiKey: 'a'.repeat(74), secret: 'c2VjcmV0LWZvci10ZXN0aW5nLW9ubHk=', customerId: '1234567' };

describe('서명 원문', () => {
  it('쿼리스트링을 «넣지 않는다»', () => {
    // 넣으면 같은 경로가 파라미터마다 다른 서명이 되어 401 이 나고,
    // 그때 「키가 틀렸다」로 오독하게 된다.
    expect(signatureMessage('1700000000000', 'GET', '/stats?ids=%5B%22a%22%5D&fields=x'))
      .toBe('1700000000000.GET./stats');
  });
  it('메서드를 대문자로 고정한다', () => {
    expect(signatureMessage('1', 'get', '/ncc/campaigns')).toBe('1.GET./ncc/campaigns');
  });
  it('구성요소가 하나라도 바뀌면 서명이 바뀐다', () => {
    const base = signSearchAd(CRED.secret, '1700000000000', 'GET', '/stats');
    expect(signSearchAd(CRED.secret, '1700000000001', 'GET', '/stats')).not.toBe(base);
    expect(signSearchAd(CRED.secret, '1700000000000', 'POST', '/stats')).not.toBe(base);
    expect(signSearchAd(CRED.secret, '1700000000000', 'GET', '/stat')).not.toBe(base);
    expect(signSearchAd('ZGlmZmVyZW50', '1700000000000', 'GET', '/stats')).not.toBe(base);
  });
  it('base64 로 낸다', () => {
    expect(signSearchAd(CRED.secret, '1', 'GET', '/x')).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe('헤더', () => {
  it('4종 + Content-Type 을 싣고 서명은 같은 path 로 만든다', () => {
    const h = searchAdHeaders(CRED, 'GET', '/ncc/campaigns', 1700000000000);
    expect(h['X-Timestamp']).toBe('1700000000000');
    expect(h['X-API-KEY']).toBe(CRED.apiKey);
    expect(h['X-Customer']).toBe('1234567');
    expect(h['X-Signature']).toBe(signSearchAd(CRED.secret, '1700000000000', 'GET', '/ncc/campaigns'));
  });
});

describe('자격 «모양» 판정 — 전사 오류의 1차 방어선', () => {
  it('세 값이 다 있어야 준비된 것이다', () => {
    expect(describeCred({ apiKey: 'x', secret: 'y' }).ready).toBe(false);
    expect(describeCred({}).note).toContain('누락');
  });
  it('hex 아닌 apiKey 를 잡는다 — O/0 · I/l 혼동은 형식으로만 걸린다', () => {
    const r = describeCred({ ...CRED, apiKey: 'O1' + 'a'.repeat(72) });
    expect(r.ready).toBe(false);
    expect(r.note).toContain('전사 오류 의심');
  });
  it('숫자 아닌 customerId 를 잡는다', () => {
    expect(describeCred({ ...CRED, customerId: '18759l4' }).ready).toBe(false);
  });
  it('⛔ 준비된 경우에도 «값을 돌려주지 않는다» — 길이만 말한다', () => {
    const r = describeCred(CRED);
    expect(r.ready).toBe(true);
    expect(r.note).not.toContain(CRED.secret);
    expect(r.note).not.toContain(CRED.apiKey);
  });
});

describe('상태 분류 — 403 은 «한 가지가 아니다»', () => {
  it('401 은 서명 · 403 은 권한/키 · 404 는 경로', () => {
    expect(classifyStatus(200)).toBe('OK');
    expect(classifyStatus(401)).toBe('SIGNATURE');
    expect(classifyStatus(403)).toBe('FORBIDDEN');
    expect(classifyStatus(404)).toBe('NOT_FOUND');
    expect(classifyStatus(429)).toBe('RATE_LIMIT');
    expect(classifyStatus(503)).toBe('SERVER');
  });
  it('⛔ 자격 실패는 재시도하지 않는다 — 같은 답이 온다', () => {
    expect(isRetryable('SIGNATURE')).toBe(false);
    expect(isRetryable('FORBIDDEN')).toBe(false);
    expect(isRetryable('RATE_LIMIT')).toBe(true);
    expect(isRetryable('SERVER')).toBe(true);
  });
});

describe('URL·날짜', () => {
  it('빈 값은 쿼리에 싣지 않는다', () => {
    const u = searchAdUrl('/stats', { ids: '["a"]', fields: '', missing: undefined });
    expect(u.startsWith(SEARCHAD_BASE + '/stats')).toBe(true);
    expect(u).toContain('ids=');
    expect(u).not.toContain('fields=');
    expect(u).not.toContain('missing');
  });
  it('KST 기준 날짜 — 경계가 어긋나면 하루가 통째로 빈다', () => {
    // 2026-08-29 23:00 UTC = 2026-08-30 08:00 KST
    expect(kstDate(new Date('2026-08-29T23:00:00Z'))).toBe('2026-08-30');
    expect(kstDate(new Date('2026-08-29T23:00:00Z'), -1)).toBe('2026-08-29');
  });
  it('최근 3일을 오래된 순으로 준다 — 전일 확정치라 재수집이 기본이다', () => {
    expect(recentDates(3, new Date('2026-08-29T03:00:00Z'))).toEqual(['2026-08-27', '2026-08-28', '2026-08-29']);
  });
});

describe('StatReport — 실측으로 뒤집힌 것들 (R-3)', () => {
  const IDS = Array.from({ length: 5 }, (_, i) => `nkw-a001-01-00000836635025${i}`);

  it('ids 를 «쉼표» 로 잇고 인코딩하지 않는다 — JSON 배열은 400 이었다', async () => {
    const { buildStatsUrl, STATS_PATH } = await import('@/lib/ads/searchad');
    const u = buildStatsUrl(IDS.slice(0, 2), '2026-08-27');
    expect(u).toContain(`${STATS_PATH}?ids=${IDS[0]},${IDS[1]}&`);
    // ⚠️ ids «구간만» 본다. fields 는 JSON 배열이 «맞아서» %5B 로 인코딩된다 —
    //    URL 전체에 대고 단언하면 정상인 fields 때문에 빨간불이 난다.
    const idsSeg = u.slice(u.indexOf('ids='), u.indexOf('&fields='));
    expect(idsSeg).not.toContain('%5B'); // ids 에 '[' 가 없어야 한다
    expect(idsSeg).not.toContain('%2C'); // 쉼표를 인코딩하지 않는다
    expect(idsSeg.split(',')).toHaveLength(2);
  });

  it('기간을 «하루» 로 좁힌다 — 그래야 합계가 곧 일별 행이 된다', async () => {
    const { buildStatsUrl } = await import('@/lib/ads/searchad');
    const u = decodeURIComponent(buildStatsUrl(IDS.slice(0, 1), '2026-08-27'));
    expect(u).toContain('{"since":"2026-08-27","until":"2026-08-27"}');
    // ⛔ timeIncrement 는 ids 와 함께 «지원되지 않는다». 붙이면 400 이다.
    expect(u).not.toContain('timeIncrement');
  });

  it('배치는 «개수» 가 아니라 URI 길이로 끊는다', async () => {
    const { chunkIdsByUri } = await import('@/lib/ads/searchad');
    const many = Array.from({ length: 500 }, (_, i) => `nkw-a001-01-${String(i).padStart(15, '0')}`);
    const chunks = chunkIdsByUri(many, 280); // ID 27자 + 쉼표 → 10개쯤에서 끊겨야 한다
    expect(chunks.every((c) => c.join(',').length <= 280 || c.length === 1)).toBe(true);
    expect(chunks.flat()).toHaveLength(500);
    expect(new Set(chunks.flat()).size).toBe(500);
  });
});

describe('⛔ 「행이 없다」는 «수집 실패가 아니다» — 세 번째 동형', () => {
  it('노출 0 인 키워드는 «행이 아예 안 온다» — 빈 data 도 정상 파싱이다', async () => {
    const { parseStatRows } = await import('@/lib/ads/searchad');
    const r = parseStatRows('{"data":[],"compTm":"202608291642"}', '2026-08-27');
    expect(r.parsed).toBe(true);   // 파싱은 «성공» 했다
    expect(r.rows).toHaveLength(0);
  });
  it('본문이 깨졌을 때만 parsed=false 다 — 그 둘을 갈라야 한다', async () => {
    const { parseStatRows } = await import('@/lib/ads/searchad');
    expect(parseStatRows('<html>414</html>', '2026-08-27').parsed).toBe(false);
    expect(parseStatRows('{"code":11001}', '2026-08-27').parsed).toBe(false);
  });
});

describe('적재 행 변환', () => {
  it('실응답을 그대로 옮긴다 (아크로라로체 08-27 실값)', async () => {
    const { parseStatRows } = await import('@/lib/ads/searchad');
    const body = JSON.stringify({ data: [{ ctr: 4.35, clkCnt: 1, cpc: 81, avgRnk: 3, id: 'nkw-a001-01-000008540645599', impCnt: 23, salesAmt: 81 }] });
    const { rows } = parseStatRows(body, '2026-08-27');
    expect(rows[0]).toMatchObject({
      keyword_id: 'nkw-a001-01-000008540645599', stat_date: '2026-08-27',
      imp_cnt: 23, clk_cnt: 1, sales_amt: 81, ctr: 4.35, cpc: 81, avg_rnk: 3,
    });
    expect(rows[0].raw).toBeTruthy(); // 원문 보존(D1 관례)
  });
  it('클릭>노출 인 행은 «위치를 남기고» 갈라 낸다 — UPSERT_FAIL 로만 남으면 원인을 못 찾는다', async () => {
    const { parseStatRows } = await import('@/lib/ads/searchad');
    const body = JSON.stringify({ data: [{ id: 'nkw-bad', impCnt: 5, clkCnt: 9, salesAmt: 0 }] });
    const r = parseStatRows(body, '2026-08-27');
    expect(r.rows).toHaveLength(0);
    expect(r.bad[0]).toContain('nkw-bad');
  });
  it('없는 지표는 0/null 로 «지어내지 않는다»', async () => {
    const { parseStatRows } = await import('@/lib/ads/searchad');
    const { rows } = parseStatRows(JSON.stringify({ data: [{ id: 'nkw-x', impCnt: 3 }] }), '2026-08-27');
    expect(rows[0]).toMatchObject({ imp_cnt: 3, clk_cnt: 0, sales_amt: 0, ctr: null, cpc: null, avg_rnk: null });
  });
});
