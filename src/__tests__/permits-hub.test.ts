/**
 * 건축HUB 인허가 파싱·정규화 (PV-2).
 *
 * 이 파일이 지키는 것: «수집기는 판단하지 않는다». 원문을 옮기고,
 * 모르는 것은 null 로 두고, 지어내지 않는다. 그 규칙이 깨지면 스테이징이
 * 원자재가 아니라 «또 하나의 주장» 이 된다.
 */
import { describe, expect, it } from 'vitest';
import {
  PERMIT_TRACKS,
  buildPermitUrl,
  isPermitCandidate,
  parsePermitItems,
  parseTotalCount,
  permitToExpectedSalePeriod,
  toInt,
  toIsoDate,
  toPermitInsert,
} from '@/lib/permits/hub';

// 무키 실측(2026-08-29)으로 확정한 오퍼레이션. 바뀌면 「돌았는데 0건」이 된다.
describe('엔드포인트', () => {
  it('주택 접두는 getHs 가 아니라 getHp 다', () => {
    expect(PERMIT_TRACKS.house.service).toBe('HsPmsHubService');
    expect(PERMIT_TRACKS.house.operation).toBe('getHpBasisOulnInfo');
    expect(PERMIT_TRACKS.arch.service).toBe('ArchPmsHubService');
    expect(PERMIT_TRACKS.arch.operation).toBe('getApBasisOulnInfo');
  });

  it('serviceKey 를 «다시 감지 않는다»', () => {
    const key = 'aB3%2BxY9%2FzQ7w%3D%3D';
    const url = buildPermitUrl('arch', key, { sigunguCd: '26350' });
    expect(url).toContain(`serviceKey=${key}`);
    expect(url).not.toContain('%252B');
  });

  it('bjdongCd 를 안 주면 파라미터 자체가 «안 붙는다» (필수 여부는 첫 실호출에서 갈린다)', () => {
    expect(buildPermitUrl('house', 'K', { sigunguCd: '31140' })).not.toContain('bjdongCd');
    expect(buildPermitUrl('house', 'K', { sigunguCd: '31140', bjdongCd: '10300' }))
      .toContain('bjdongCd=10300');
  });
});

const XML = `<response><body>
  <items>
    <item>
      <mgmHsrgstPk>31140-100123</mgmHsrgstPk>
      <sigunguCd>31140</sigunguCd><bjdongCd>10300</bjdongCd>
      <platPlc>울산광역시 남구 신정동 123-4</platPlc>
      <newPlatPlc>울산광역시 남구 중앙로 1</newPlatPlc>
      <bldNm>그랑라크 에일린의 뜰</bldNm>
      <totHhldCnt>1,234</totHhldCnt><mainBldCnt>12</mainBldCnt>
      <mainPurpsCdNm>공동주택</mainPurpsCdNm>
      <apprvDay>20260731</apprvDay><stcnsSchedDay>20260915</stcnsSchedDay>
      <useInsptSchedDay>20290228</useInsptSchedDay>
      <crtnDay>20260828</crtnDay>
    </item>
    <item>
      <mgmHsrgstPk>31140-100124</mgmHsrgstPk>
      <bldNm>빈 값 섞인 행</bldNm>
      <totHhldCnt></totHhldCnt><apprvDay>  </apprvDay>
    </item>
  </items>
  <totalCount>2</totalCount>
</body></response>`;

describe('파싱', () => {
  it('태그 이름 그대로 뽑는다 — 필드를 골라 담지 않는다', () => {
    const items = parsePermitItems(XML);
    expect(items).toHaveLength(2);
    expect(items[0].bldNm).toBe('그랑라크 에일린의 뜰');
    expect(items[0].crtnDay).toBe('20260828'); // 정규화 대상이 아닌 필드도 raw 에 남는다
  });

  it('빈 값은 «키 자체가 없다» — 「없음」과 「빈 값」을 섞지 않는다', () => {
    const items = parsePermitItems(XML);
    expect('totHhldCnt' in items[1]).toBe(false);
    expect('apprvDay' in items[1]).toBe(false);
  });

  it('totalCount 를 읽는다 (페이지네이션 판정용)', () => {
    expect(parseTotalCount(XML)).toBe(2);
    expect(parseTotalCount('<a/>')).toBeNull();
  });

  it('item 이 없으면 빈 배열 — 에러 XML 도 여기서는 조용하다(봉투는 readEnvelope 가 본다)', () => {
    expect(parsePermitItems('<OpenAPI_ServiceResponse/>')).toEqual([]);
  });
});

describe('형 변환 — 모르면 null, 지어내지 않는다', () => {
  it('YYYYMMDD 만 날짜로 본다', () => {
    expect(toIsoDate('20260915')).toBe('2026-09-15');
    expect(toIsoDate('2026-09-15')).toBeNull();
    expect(toIsoDate('20261315')).toBeNull(); // 13월
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });

  it('콤마 섞인 세대수를 읽는다', () => {
    expect(toInt('1,234')).toBe(1234);
    expect(toInt('abc')).toBeNull();
    expect(toInt(undefined)).toBeNull();
  });

  it('착공예정 → 분양예정시기는 «월 절사» 다', () => {
    expect(permitToExpectedSalePeriod('20260915')).toBe('2026-09');
    // ⛔ 일까지 아는 것처럼 쓰지 않는다. 없으면 null(미정)이다.
    expect(permitToExpectedSalePeriod(undefined)).toBeNull();
    expect(permitToExpectedSalePeriod('없음')).toBeNull();
  });
});

describe('후보 판정', () => {
  it('30세대 미만은 뺀다', () => {
    expect(isPermitCandidate({ totHhldCnt: '12' })).toBe(false);
    expect(isPermitCandidate({ totHhldCnt: '30' })).toBe(true);
  });

  it('⚠️ 세대수를 «모르면» 버리지 않는다 — 모르는 것과 작은 것은 다르다', () => {
    expect(isPermitCandidate({ bldNm: 'x' })).toBe(true);
  });

  it('이미 사용검사가 «난» 건물은 뺀다 (예정일만 있는 것은 남긴다)', () => {
    expect(isPermitCandidate({ useInsptDay: '20240101' })).toBe(false);
    expect(isPermitCandidate({ useInsptSchedDay: '20290228' })).toBe(true);
  });
});

describe('정규화', () => {
  const item = parsePermitItems(XML)[0];

  it('시도·시군구는 «코드에서» 유도한다 — 주소 문자열을 파싱하지 않는다', () => {
    const row = toPermitInsert('house', item, { sigunguCd: '31140' })!;
    expect(row.sido).toBe('울산');
    expect(row.sigungu).toBe('남구');
  });

  it('원문을 그대로 옮긴다 · 법정동 10자리를 조립한다', () => {
    const row = toPermitInsert('house', item, { sigunguCd: '31140' })!;
    expect(row.source).toBe('hub:house');
    expect(row.source_key).toBe('31140-100123');
    expect(row.project_name).toBe('그랑라크 에일린의 뜰');
    expect(row.total_units).toBe(1234);
    expect(row.lawd_cd).toBe('31140');
    expect(row.bjd_cd).toBe('3114010300');
    expect(row.permit_date).toBe('2026-07-31');
    expect(row.construct_start_expected).toBe('2026-09-15');
    expect(row.use_approval_expected).toBe('2029-02-28');
    expect(row.raw).toBe(item); // 원문은 손대지 않는다
  });

  it('응답의 sigunguCd 가 «요청한 코드보다» 이긴다 (D5-4 — 수집이 틀린 것을 잡는다)', () => {
    const row = toPermitInsert('house', item, { sigunguCd: '26350' })!;
    expect(row.lawd_cd).toBe('31140');
  });

  it('고유키가 없으면 «넣지 않는다» — 재수집이 중복을 만들 길을 열지 않는다', () => {
    expect(toPermitInsert('arch', { bldNm: '키없음' }, { sigunguCd: '26350' })).toBeNull();
  });

  it('모르는 시군구 코드면 지역을 «비운다» — 틀린 지역을 채우지 않는다', () => {
    const row = toPermitInsert('arch', { mgmBldrgstPk: 'X1', sigunguCd: '99999' }, { sigunguCd: '99999' })!;
    expect(row.sido).toBeNull();
    expect(row.sigungu).toBeNull();
  });
});
