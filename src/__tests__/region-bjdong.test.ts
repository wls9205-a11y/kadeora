/**
 * 법정동코드 판정 (PV-2).
 * ⚠️ 이 판정이 스크립트 안에 있으면 tsc 가 안 본다(Rule #116). 그래서 lib 에 두고 잠근다.
 */
import { describe, expect, it } from 'vitest';
import { dongName, isBjdongLevel, isRiCode, splitRegionCd } from '@/lib/region/bjdong';

describe('splitRegionCd — 건축HUB 의 두 파라미터로 쪼갠다', () => {
  it('무거동: 3114010100 → 31140 + 10100 (실호출로 통한 조합)', () => {
    expect(splitRegionCd('3114010100')).toEqual({ sigunguCd: '31140', bjdongCd: '10100' });
  });

  it('10자리가 아니면 null — 지어내지 않는다', () => {
    expect(splitRegionCd('31140')).toBeNull();
    expect(splitRegionCd('31140101000')).toBeNull();
    expect(splitRegionCd('')).toBeNull();
  });
});

describe('isBjdongLevel — 무엇을 부를 것인가', () => {
  it('시도·시군구 머리 행은 뺀다 (동이 아니다)', () => {
    expect(isBjdongLevel({ umd_cd: '000' })).toBe(false);
  });

  it('동·읍·면은 넣는다', () => {
    expect(isBjdongLevel({ umd_cd: '101' })).toBe(true);
    expect(isBjdongLevel({ umd_cd: '250' })).toBe(true);
  });

  /**
   * ⚠️⚠️ 처음엔 「리는 읍면 조회에 포함되니 빼자」로 잡았다가 실측에서 뒤집혔다.
   *    기장읍(25000) 25건 / 동부리(25021) 658건 — 읍 조회에 «안 들어 있다».
   *    빼면 기장읍에서만 658건이 사라지고, 그 0 은 「API 에 없다」와 구분되지 않는다.
   */
  it('리도 «넣는다» — 읍면 조회는 리를 포함하지 않는다 (실측)', () => {
    expect(isBjdongLevel({ umd_cd: '250' })).toBe(true);
  });
});

describe('dongName', () => {
  it('locallow_nm 을 «그대로» 쓴다 — 주소를 자르지 않는다', () => {
    expect(dongName({ locallow_nm: '무거동', locatadd_nm: '울산광역시 남구 무거동' })).toBe('무거동');
  });

  it('locallow_nm 이 비면 주소 마지막 토막으로 내려간다', () => {
    expect(dongName({ locallow_nm: '', locatadd_nm: '울산광역시 남구 무거동' })).toBe('무거동');
  });
});

describe('isRiCode — 리 검출을 «따로» 센다', () => {
  it('뒤 2자리가 00 이면 동·읍·면', () => {
    expect(isRiCode('10100')).toBe(false);
    expect(isRiCode('25000')).toBe(false);
  });

  it('뒤 2자리가 있으면 리 — 동부리(25021)가 기장읍(25000)보다 26배 많았다', () => {
    expect(isRiCode('25021')).toBe(true);
  });

  it('5자리가 아니면 리가 아니다', () => {
    expect(isRiCode('250')).toBe(false);
  });
});
