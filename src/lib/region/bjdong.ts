/**
 * 법정동코드 — 건축HUB 의 `bjdongCd` (PV-2).
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * 인허가 API 는 `sigunguCd` 만으로는 «빈 응답» 을 준다(실측: 부울경 43코드 전수 0건).
 * `bjdongCd` 를 넣는 순간 실데이터가 온다. 즉 이 표가 없으면 수집이 성립하지 않는다.
 *
 * ── 코드 구조 (행정표준코드 StanReginCd) ────────────────────────────────────
 *   region_cd(10) = sido_cd(2) + sgg_cd(3) + umd_cd(3) + ri_cd(2)
 *   건축HUB sigunguCd = 앞 5자리 · bjdongCd = «뒤 5자리»
 *   예) 3114010100 → sigunguCd 31140 · bjdongCd 10100 (울산 남구 무거동)
 *
 * ⚠️ 자기발견 스윕으로 대신하려 했다가 «군 지역을 통째로 놓친다» 는 것을 실측했다:
 *      울산 남구  10100~11300 에 11개
 *      부산 기장군 25000(기장읍) · 25600(정관읍) · 32000 — 101~118 대역엔 «없다»
 *    코드대가 시·군마다 달라 좁은 스캔은 조용히 샌다. 권위 있는 목록을 쓴다.
 */

/** StanReginCd 한 행에서 우리가 보는 필드만. */
export interface StanReginRow {
  region_cd: string;
  sido_cd: string;
  sgg_cd: string;
  umd_cd: string;
  ri_cd: string;
  locatadd_nm: string;
  locallow_nm: string;
}

/**
 * 부를 «대상» 인가 — 시도·시군구 머리 행만 뺀다.
 *
 * ⚠️⚠️ 처음엔 「리는 읍면 단위 조회에 포함되니 빼자」로 잡았다. **틀렸다.**
 *    실측(2026-08-29 · 부산 기장군 arch):
 *        25000 기장읍(ri=00)  totalCount   25
 *        25021 동부리(ri=21)  totalCount  658   ← 읍 조회에 «안 들어 있다»
 *    리를 빼면 기장읍에서만 658건이 통째로 사라지고, 그 0 은 「API 에 없다」와
 *    구분되지 않는다. 호출이 3배가 되더라도 리를 «넣는다».
 *
 * ⚠️ 그 대신 호출 예산이 커진다 — 부울경 법정동 약 2,835 × 2트랙 ≈ 5,670/일.
 *    일 한도 10,000 안이지만 한 번에 돌릴 수 없다(초당 제한 + 크론 300초).
 *    수집은 «쪼개서» 돈다.
 */
export function isBjdongLevel(row: Pick<StanReginRow, 'umd_cd'>): boolean {
  return row.umd_cd !== '000';
}

/** region_cd → { sigunguCd, bjdongCd }. 10자리가 아니면 null — 지어내지 않는다. */
export function splitRegionCd(regionCd: string): { sigunguCd: string; bjdongCd: string } | null {
  const s = (regionCd ?? '').trim();
  if (!/^\d{10}$/.test(s)) return null;
  return { sigunguCd: s.slice(0, 5), bjdongCd: s.slice(5) };
}

/**
 * 「울산광역시 남구 무거동」 → 「무거동」.
 * ⚠️ locallow_nm 이 이미 그 값이라 그것을 «그대로» 쓴다. 주소 문자열을 자르지 않는다 —
 *    표기가 흔들리면 같은 동이 두 이름이 된다(PV-1 에서 배운 것과 같다).
 */
export function dongName(row: Pick<StanReginRow, 'locallow_nm' | 'locatadd_nm'>): string {
  return (row.locallow_nm || '').trim() || (row.locatadd_nm || '').trim().split(' ').pop() || '';
}

/**
 * 리(里) 단위 코드인가 — bjdongCd 뒤 2자리가 ri_cd 다.
 * ⚠️ 커버율 리포트에서 «따로» 센다. 리를 빼면 군 지역이 통째로 사라진다는 것을
 *    기장읍 25건 / 동부리 658건 으로 배웠다 — 그 교정이 실제로 얼마를 건졌는지
 *    수치로 보이지 않으면 다음 사람이 같은 최적화를 또 시도한다.
 */
export function isRiCode(bjdongCd: string): boolean {
  return /^\d{5}$/.test(bjdongCd) && bjdongCd.slice(3) !== '00';
}
