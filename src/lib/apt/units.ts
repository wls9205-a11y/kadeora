// V15 C — 세대수 두 축.
//
// 왜 갈라야 하나: `total_units` 는 이름과 달리 **이번 분양의 공급 세대수**를 담고 있었다.
// apt_sites × 청약 2,800쌍 중 2,698(96.4%)이 공고의 공급 세대수와 같은 값이었다.
//
//   올림픽파크 포레온   일반분양 4,786 / 단지 전체 12,032
//   둔산 자이 아이파크   일반분양    12 / 단지 전체  2,400
//
// 그래서 DB 가 두 컬럼으로 갈랐다.
//   supply_units   이번 분양 공급(일반분양 + 특별공급)   실측 2,747건
//   complex_units  단지 전체(조합원분 포함)             실측   465건
//   total_units    @deprecated — 어느 쪽인지 알 수 없다
//
// ⚠️ `total_units` 를 폴백으로 쓰지 말 것. 96% 가 공급 수치라 '단지 전체' 자리에 넣으면
//    틀린 숫자를 말하게 된다. 실측상 total_units 가 있는 3,130건은 전부 supply 또는
//    complex 중 하나를 갖고 있어 폴백이 필요 없다.
// ⚠️ 모르면 `미확인`. apt_complex_profiles 로 채우려던 시도는 34,544건 중 96건만
//    값이 있어 못 쓴다. 추정치를 쓰지 않는다 (표시·광고법).

export interface UnitCounts {
  /** 이번 분양 공급. 경쟁률·분양가의 분모다. */
  supply: number | null;
  /** 단지 전체. 규모·관리비의 기준이다. */
  complex: number | null;
}

const pos = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * 현장 + 모집공고에서 두 축을 뽑는다.
 * 공고(apt_subscriptions)도 같은 두 축을 갖고 있다 —
 * `tot_supply_hshld_co` 가 공급, `total_households` 가 단지 전체다.
 */
export function resolveUnits(
  site?: { supply_units?: number | null; complex_units?: number | null } | null,
  sub?: { tot_supply_hshld_co?: number | null; total_households?: number | null } | null,
): UnitCounts {
  return {
    supply: pos(site?.supply_units) ?? pos(sub?.tot_supply_hshld_co),
    complex: pos(site?.complex_units) ?? pos(sub?.total_households),
  };
}

export interface UnitCell {
  label: string;
  value: string;
  note?: string;
}

/**
 * KPI 한 칸. 무엇을 세는 숫자인지 라벨이 반드시 밝힌다 —
 * '세대수 176' 은 일반분양인지 단지 전체인지 알 수 없어 오독을 부른다.
 *
 * ⚠️ 라벨을 '일반분양' 으로 쓰지 않는다. supply_units 는 일반분양 + 특별공급이라
 *    '일반분양' 은 사실과 다르다 (move_in_ready 를 '입주 준비' 로 쓰던 것과 같은 실수).
 */
export function unitCell(u: UnitCounts): UnitCell {
  if (u.supply && u.complex) {
    return {
      label: '분양 공급',
      value: u.supply.toLocaleString('ko-KR'),
      note: `총 ${u.complex.toLocaleString('ko-KR')}세대`,
    };
  }
  if (u.supply) return { label: '분양 공급', value: u.supply.toLocaleString('ko-KR'), note: '세대' };
  if (u.complex) return { label: '단지 전체', value: u.complex.toLocaleString('ko-KR'), note: '세대' };
  return { label: '세대수', value: '미확인' };
}

/** 히어로 보조줄·공유 문구용 한 줄. 없으면 null — '0세대' 를 만들지 않는다. */
export function unitsSummary(u: UnitCounts): string | null {
  if (u.supply && u.complex) return `분양 ${u.supply.toLocaleString('ko-KR')} / 총 ${u.complex.toLocaleString('ko-KR')}세대`;
  if (u.supply) return `분양 ${u.supply.toLocaleString('ko-KR')}세대`;
  if (u.complex) return `총 ${u.complex.toLocaleString('ko-KR')}세대`;
  return null;
}
