/**
 * PV2-C — 승격 이름 판정 잠금 (2026-09-05).
 *
 * 아래는 전부 «예행에서 실제로 나온» 산출이다. 세 번 연속으로 이름 결함을 배포했고,
 * 그때마다 배포 왕복(≈4분)을 태웠다. 이 파일이 그 왕복을 대신한다.
 * ⛔ 케이스를 지우지 말 것 — 지우면 같은 이름이 다시 나온다.
 */
import { describe, expect, it } from 'vitest';
import { cleanProjectName, projectKey, usableAsProject } from '@/lib/permits/promote-name';

describe('cleanProjectName — 행정 접두는 머리에서만', () => {
  it('시도·시군구를 반복해서 뗀다', () => {
    expect(cleanProjectName('부산광역시 부산진구 범천동 858-6번지 일원 희망더함아파트'))
      .toBe('범천동 858-6번지 일원 희망더함아파트');
    expect(cleanProjectName('울산 광역시 남구 신정동 563-1 일원 주상복합 신축공사'))
      .toBe('신정동 563-1 일원 주상복합');
    expect(cleanProjectName('부산시 동래구 명륜동 00공동주택')).toBe('명륜동 00공동주택');
  });

  it('시도 약칭 뒤에 시군구가 오는 형태도 뗀다 (1·3차 예행 잔재)', () => {
    expect(cleanProjectName('부산 연제구 거제동 129-5번지 주거복합 신축공사'))
      .toBe('거제동 129-5번지 주거복합');
  });

  // ⚠️ 2·3차 예행이 여기서 죽었다.
  it('⛔ 「…지구」·「…구역」의 구를 시군구로 읽지 않는다', () => {
    expect(cleanProjectName('창원 풍호장천지구 1BL 공동주택 신축공사'))
      .toBe('창원 풍호장천지구 1BL 공동주택');
    expect(cleanProjectName('진주시 판문지구 공동주택 1단지')).toBe('판문지구 공동주택 1단지');
    expect(cleanProjectName('진주시 판문도시개발사업지구 2BL 공동주택'))
      .toBe('판문도시개발사업지구 2BL 공동주택');
    expect(cleanProjectName('상남산호지구 주택재개발 정비사업(2단지)'))
      .toBe('상남산호지구 주택재개발 정비사업(2단지)');
  });

  it('⚠️ 동+지번은 남긴다 — 그것이 유일한 식별자인 원문이 있다', () => {
    expect(cleanProjectName('사하구 다대동 370-11번지 일원 공동주택 신축공사'))
      .toBe('다대동 370-11번지 일원 공동주택');
  });
});

describe('usableAsProject — 브랜드 단독은 거부', () => {
  it('⛔ 브랜드만 있는 원문은 페이지를 만들지 않는다', () => {
    expect(usableAsProject('힐스테이트')).toBe(false);
    expect(usableAsProject('호반 써밋')).toBe(false);
    expect(usableAsProject('아파트 및 부대복리시설')).toBe(false);
  });

  it('구역·지구·블록 식별자가 있으면 통과', () => {
    expect(usableAsProject('반월구역 재개발 공동주택')).toBe(true);
    expect(usableAsProject('판문지구 공동주택 1단지')).toBe(true);
    expect(usableAsProject('부산명지 A-5BL 공동주택')).toBe(true);
    expect(usableAsProject('상남1구역 재건축')).toBe(true);
  });

  it('법정동이 남아 있으면 통과 — 괄호가 바로 뒤에 와도(3차 예행 오탈락)', () => {
    expect(usableAsProject('모라동(270-3번지 일원) 공동주택')).toBe(true);
    expect(usableAsProject('연산동 주상복합')).toBe(true);
    expect(usableAsProject('다대동 370-11번지 일원 공동주택')).toBe(true);
  });

  it('⚠️ 동도 구역도 없는 원문은 «만들지 않고» 남긴다 — 검수로 간다', () => {
    // 실재하는 사업이지만 이름만으로는 위치를 가리키지 못한다. 버리는 게 아니라 안 만드는 것이다.
    expect(usableAsProject('울산 모바일테크 공동주택')).toBe(false);
    expect(usableAsProject('한일시멘트 이전부지 공동주택')).toBe(false);
  });
});

describe('projectKey — 같은 사업의 분할 인허가는 한 덩어리', () => {
  it('단지·블록 꼬리를 털어 같은 키로 모은다', () => {
    expect(projectKey('상남산호지구 주택재개발 정비사업(2단지)', '창원시'))
      .toBe(projectKey('창원 상남산호지구 주택재개발 정비사업(4단지)', '창원시'));
  });

  it('⛔ 다른 사업은 섞지 않는다', () => {
    expect(projectKey('상남1구역 재건축', '창원시')).not.toBe(projectKey('반월구역 재개발 공동주택', '창원시'));
    // ⛔ 시군구 약칭이 아닌 머리는 «떼지 않는다» — 떼면 서로 다른 사업이 한 덩어리가 된다.
    expect(projectKey('연산동 주상복합', '연제구')).not.toBe(projectKey('중동 주상복합', '해운대구'));
  });
});
