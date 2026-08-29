// 분양예정시기 표기 — `apt_sites.expected_sale_period` 의 «가변 정밀도» 를 화면 문구로.
//
// ── 왜 lib 인가 (Rule #116) ─────────────────────────────────────────────────
// 이건 «판정» 이다. 틀리면 화면이 «원문보다 정밀한 시기» 를 말하게 되고,
// 그건 §7-1(말한 만큼만 표기) 위반이자 표시광고 리스크다.
// 「2026년」밖에 모르는 현장에 「2026년 하반기」라고 쓰면 근거 없는 시기를 지어낸 것이다.
// scripts/ 는 tsc 사각지대라 이런 판정을 거기 두지 않는다.
//
// ── 저장 형식 (마이그레이션 pv2b 가 제약으로 고정) ──────────────────────────
//   '2026'      연도만
//   '2026H2'    반기
//   '2026Q3'    분기
//   '2026-09'   월
//   null        미정  ← 「모른다」를 값으로 지어내지 않는다
//
// ⛔ 상향 추정 금지. 연도만 있는 값을 반기로 «올려» 쓰지 않는다.
// ⛔ 하향 추정도 금지. 월을 아는 값을 분기로 «내려» 쓰지 않는다 — 아는 정보를 버리는 것이다.

/** 저장값의 정밀도. 화면이 「얼마나 아는지」를 스스로 말할 수 있어야 한다. */
export type SalePeriodPrecision = 'year' | 'half' | 'quarter' | 'month';

export interface SalePeriod {
  /** 화면 문구. 예: '2026년 9월' */
  label: string;
  precision: SalePeriodPrecision;
}

const RE = /^(\d{4})(?:(H[12])|(Q[1-4])|-(0[1-9]|1[0-2]))?$/;

/**
 * @returns 못 읽는 값이면 **null**. ⛔ 「미정」 같은 문구를 «지어내지 않는다» —
 *          호출부가 「값이 없다」와 「형식이 깨졌다」를 구분해 다룰 수 있어야 한다.
 */
export function parseSalePeriod(raw: string | null | undefined): SalePeriod | null {
  if (!raw) return null;
  const m = RE.exec(raw.trim());
  if (!m) return null;
  const [, year, half, quarter, month] = m;
  if (month) return { label: `${year}년 ${Number(month)}월`, precision: 'month' };
  if (quarter) return { label: `${year}년 ${quarter[1]}분기`, precision: 'quarter' };
  if (half) return { label: `${year}년 ${half === 'H1' ? '상' : '하'}반기`, precision: 'half' };
  return { label: `${year}년`, precision: 'year' };
}

/**
 * §7-1 한정어까지 붙인 «화면에 그대로 쓸» 문구.
 *
 * ⚠️ 「분양예정」이 한정어다. 「분양」이라고만 쓰면 확정으로 읽힌다 —
 *    확정 표기는 verified 일 때뿐이고, 그마저도 이 값은 «예정» 이라 확정이 될 수 없다.
 * ⛔ 「분양 개시」·「분양 시작」 같은 표현을 쓰지 않는다(§7-1 표시광고 금지 표현).
 */
export function salePeriodText(raw: string | null | undefined): string | null {
  const p = parseSalePeriod(raw);
  return p ? `${p.label} 분양예정` : null;
}
