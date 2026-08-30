/**
 * 인증키 확장 ① — 면적 «타입표» 판정 (2026-08-30 · HsPms 호별 실측).
 *
 * ── 원천 ────────────────────────────────────────────────────────────────────
 *   getHpHoOulnInfo          호별 전수. `pngtypGbNm` 이 «타입표 그 자체» 다
 *   getHpExposPubuseAreaInfo 전유/공용 면적. 타입 라벨에 «실면적» 을 붙일 때 쓴다
 * ⚠️ 두 번째는 «타입별 대표 행» 이라 세대 수를 세지 못한다(야음동 357-7 이 전유 6호로 온다).
 *    세대 수는 반드시 호별(첫 번째)에서 센다.
 *
 * ── 실측에서 나온 오염 2종 (2026-08-30, 울산 남구 야음동 600호) ──────────────
 *   ① 「(근생)214」 — 근린생활시설이 타입 칸에 있다. 주거 타입표에 넣으면 세대수가 부푼다
 *   ② 「102동2002호」 — «호 표기» 가 타입 칸에 들어왔다. 입력 사고이지 타입이 아니다
 * ── 그리고 표기가 «두 체계» 다 ─────────────────────────────────────────────
 *   평형계열 「84A」 「59」 「70B」      — 숫자는 «전용면적 반올림» 이고 뒤 글자가 타입 구분
 *   면적계열 「21.62C」 「30.59A」       — 숫자가 «면적 그대로»
 * ⛔ 둘을 같은 축으로 정렬하면 「21.62」가 「59」보다 작다는 «틀린 순서» 가 나온다.
 *    kind 를 갈라 두고, 정렬은 areaHint 로 한다.
 */
export type UnitTypeKind = 'apt' | 'retail' | 'malformed';

export interface UnitTypeParsed {
  /** 원문 그대로. 화면에 그대로 쓸 수 있는 라벨이다. */
  label: string;
  kind: UnitTypeKind;
  /** 정렬·매칭용 숫자. 평형계열이면 반올림 면적, 면적계열이면 면적 그대로. 모르면 null. */
  areaHint: number | null;
  /** 「84A」의 A. 없으면 null. */
  suffix: string | null;
}

/** 근생·부속은 주거 타입이 «아니다». 여기서 세면 세대수가 부푼다. */
const RETAIL = /^\(?(근생|근린|상가|판매|업무|오피스)/;
/** 「102동2002호」 처럼 호 표기가 들어온 것 — 입력 사고다. */
const HO_NOTATION = /\d+\s*동\s*\d+\s*호/;

export function parseUnitType(raw: string | null | undefined): UnitTypeParsed | null {
  const label = String(raw ?? '').trim();
  if (!label) return null;
  if (RETAIL.test(label)) return { label, kind: 'retail', areaHint: null, suffix: null };
  if (HO_NOTATION.test(label)) return { label, kind: 'malformed', areaHint: null, suffix: null };

  // 「84A」 「59」 「21.62C」 「84.98」 — 숫자 + 선택적 접미 글자
  const m = label.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*([A-Za-z가-힣]{0,3})$/);
  if (!m) return { label, kind: 'malformed', areaHint: null, suffix: null };
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 400) {
    return { label, kind: 'malformed', areaHint: null, suffix: null };
  }
  return { label, kind: 'apt', areaHint: n, suffix: m[2] || null };
}

export interface HoRow {
  bldNm?: string | null;
  /** 지번 주소 — 면적 소스와 «같은 건물» 을 고르는 축이다. */
  platPlc?: string | null;
  dongNm?: string | null;
  pngtypGbNm?: string | null;
  hoNo?: string | null;
}

export interface TypeRow {
  /**
   * ⚠️ `pngtypGbNm` «원문 그대로». 이것이 타입의 구분자다 —
   *    70A 와 70B 는 면적이 같아도 «다른 타입» 이고, 화면은 이 라벨로 구분한다.
   *    ⛔ 표에 저장할 때도 이 값을 «보존 컬럼» 으로 둔다(가공본으로 대체 금지).
   */
  label: string;
  units: number;
  areaHint: number | null;
  suffix: string | null;
}

export interface TypeTable {
  building: string;
  /**
   * 이 건물의 지번 주소들(정규화본).
   * ⚠️ 면적 후보를 «이 건물로 좁히는» 데 쓴다. 좁히지 않으면 법정동 전체의 면적이
   *    한 단지에 쏟아져 「59㎡대 후보 6종」이 되고, 전부 «미확정» 이 된다(2026-08-30 실측).
   */
  platPlcs: string[];
  dongs: number;
  /** 주거 타입 행 — 면적 오름차순. 화면의 「타입·분양가」 표가 이걸 먹는다. */
  types: TypeRow[];
  totalUnits: number;
  /** ⚠️ 걸러 낸 몫. 「그냥 없었다」와 「제외했다」는 다른 사실이다. */
  excluded: { retail: number; malformed: number; empty: number };
  /** 표기 체계가 섞였는가 — 섞였으면 사람이 봐야 한다. */
  mixedNotation: boolean;
}

/**
 * 한 건물의 타입표를 만든다.
 * ⛔ 근생·호표기·빈값을 «세지 않되 버린 수를 남긴다».
 * ⚠️ 평형계열과 면적계열이 «섞이면» mixedNotation 을 세운다 — 한 단지 안에서
 *    두 체계가 나오는 건 데이터가 이상한 것이고, 정렬을 믿으면 안 된다.
 */
export function buildTypeTable(building: string, rows: HoRow[]): TypeTable {
  const counts = new Map<string, { n: number; p: UnitTypeParsed }>();
  const excluded = { retail: 0, malformed: 0, empty: 0 };
  const dongs = new Set<string>();
  const plats = new Set<string>();

  for (const r of rows) {
    if (r.dongNm) dongs.add(String(r.dongNm).trim());
    const pp = normalizePlat(r.platPlc);
    if (pp) plats.add(pp);
    const p = parseUnitType(r.pngtypGbNm);
    if (!p) { excluded.empty++; continue; }
    if (p.kind === 'retail') { excluded.retail++; continue; }
    if (p.kind === 'malformed') { excluded.malformed++; continue; }
    const cur = counts.get(p.label);
    if (cur) cur.n++;
    else counts.set(p.label, { n: 1, p });
  }

  const types: TypeRow[] = [...counts.values()]
    .map(({ n, p }) => ({ label: p.label, units: n, areaHint: p.areaHint, suffix: p.suffix }))
    .sort((a, b) => (a.areaHint ?? 0) - (b.areaHint ?? 0) || a.label.localeCompare(b.label));

  // 평형계열(정수)과 면적계열(소수)이 함께 있으면 섞인 것이다.
  const hasInt = types.some((t) => t.areaHint !== null && Number.isInteger(t.areaHint));
  const hasDec = types.some((t) => t.areaHint !== null && !Number.isInteger(t.areaHint));

  return {
    building,
    platPlcs: [...plats],
    dongs: dongs.size,
    types,
    totalUnits: types.reduce((a, t) => a + t.units, 0),
    excluded,
    mixedNotation: hasInt && hasDec,
  };
}

/** 여러 건물을 한 번에 — 호별 응답을 bldNm 으로 갈라 표를 만든다. */
export function buildTypeTables(rows: HoRow[]): TypeTable[] {
  const byBld = new Map<string, HoRow[]>();
  for (const r of rows) {
    const k = String(r.bldNm ?? '').trim() || '(이름없음)';
    byBld.set(k, [...(byBld.get(k) ?? []), r]);
  }
  return [...byBld.entries()]
    .map(([b, rs]) => buildTypeTable(b, rs))
    .sort((a, b) => b.totalUnits - a.totalUnits);
}

/**
 * 지번 주소 정규화 — 두 소스의 표기가 «미묘하게 다르다».
 *   호별   「울산광역시 남구 야음동 357-7번지」
 *   면적   「울산광역시 남구 야음동 357-7」      ← 「번지」가 없다
 * ⛔ 그대로 비교하면 «같은 건물이 안 붙는다».
 */
export function normalizePlat(s: string | null | undefined): string {
  return String(s ?? '').replace(/번지\s*$/, '').replace(/\s+/g, ' ').trim();
}

export interface AreaRow {
  platPlc?: string | null;
  exposPubuseGbCdNm?: string | null;
  mainAtchGbCdNm?: string | null;
  purpsCdNm?: string | null;
  area?: string | number | null;
}

/**
 * 전유면적 목록 — 타입 라벨에 «실면적» 을 붙일 때 쓴다.
 * ⚠️ `purpsCdNm` 은 실측에서 「아파트」다 — 「공동주택」이 아니다. 어휘를 지어내지 않는다.
 * ⛔ 이 목록으로 «세대 수를 세지 않는다» — 타입별 대표 행이라 실제 호수보다 훨씬 적다.
 */
export interface AreaCandidate {
  area: number;
  /** 상대 소스가 타입 접미를 «준다면» 여기 담는다. 실측상 전유면적 응답에는 없다. */
  suffix?: string | null;
}

/**
 * 전유면적 후보. `plats` 를 주면 «그 건물만» 남긴다.
 * ⚠️ 안 좁히면 법정동 전체가 섞여 「후보 유일」 판정이 사실상 불가능해진다 —
 *    그러면 전부 미확정이 되고, 그건 과교정이다(아는 것까지 버린다).
 */
export function exclusiveAreas(rows: AreaRow[], plats?: string[]): AreaCandidate[] {
  const want = plats ? new Set(plats.map(normalizePlat)) : null;
  return rows
    .filter((r) => !want || want.has(normalizePlat(r.platPlc)))
    .filter((r) => (r.exposPubuseGbCdNm ?? '').trim() === '전유')
    .filter((r) => (r.mainAtchGbCdNm ?? '').trim() === '주건축물')
    .filter((r) => /아파트|공동주택|연립|다세대/.test(String(r.purpsCdNm ?? '')))
    .map((r) => ({ area: Number(r.area), suffix: null }))
    .filter((c) => Number.isFinite(c.area) && c.area > 0)
    .sort((a, b) => a.area - b.area);
}

export interface AreaMatch {
  /** 이 «타입 하나» 에 단정할 수 있는 전유면적. 단정 못 하면 null. */
  exact: number | null;
  /** 같은 면적 계열에서 «관측된» 값들. 단정이 아니라 관측이다. */
  series: number[];
  /** 왜 단정했는지 / 못 했는지. 화면 문구와 검수 근거가 여기서 나온다. */
  note: string;
}

/**
 * 타입 라벨 ↔ 실면적 매칭 — «2키(전용면적, 접미)» 로 한다 (C′ 판정 ⑩).
 *
 * ⛔ areaHint 단독 매칭을 버렸다. 그것이 「70A 와 70B 에 같은 70.17㎡」를 만들었다.
 *    다른 평면인데 같은 면적처럼 보이는 것은 «단정» 이고, 근거가 없다.
 * ⛔ 그렇다고 「약 70㎡」로 뭉개지도 «않는다» — 70A 가 70.17㎡ 라는 사실이 확인되면
 *    그건 사실이므로 그대로 쓴다. 뭉개기는 아는 것을 버리는 것이다.
 *
 * 규칙:
 *   ① 면적계열(21.62C) — 라벨 자체가 면적이다. 그대로 단정.
 *   ② 상대 소스에 «접미가 있으면» 2키(면적+접미) 정합으로 단정.
 *   ③ 접미가 없으면 — 계열 안 후보가 «유일할 때만» 단정한다.
 *      둘 이상이면 series 로 «관측만» 남기고 단정하지 않는다.
 *      (a5 의 「2건 이상이면 null」과 같은 규율 — 단정 못 하는 건 안 하는 게 D4 정신이다.)
 */
export function matchArea(t: TypeRow, areas: AreaCandidate[], tol = 1.5): AreaMatch {
  if (t.areaHint === null) return { exact: null, series: [], note: '면적 힌트 없음' };

  // ① 면적계열 — 라벨이 이미 면적이다.
  if (!Number.isInteger(t.areaHint)) {
    return { exact: t.areaHint, series: [t.areaHint], note: '라벨이 면적 그대로' };
  }

  const inSeries = areas.filter((c) => Math.abs(c.area - t.areaHint!) <= tol);
  const series = [...new Set(inSeries.map((c) => c.area))].sort((a, b) => a - b);
  if (series.length === 0) return { exact: null, series: [], note: `${t.areaHint}㎡대 관측 없음` };

  // ② 상대에 접미가 있으면 2키 정합
  if (t.suffix) {
    const keyed = inSeries.filter((c) => (c.suffix ?? '').toUpperCase() === t.suffix!.toUpperCase());
    if (keyed.length === 1) return { exact: keyed[0].area, series, note: `2키 정합(${t.areaHint}·${t.suffix})` };
    if (keyed.length > 1) {
      return { exact: null, series, note: `2키에도 후보 ${keyed.length} — 단정하지 않는다` };
    }
    // 상대에 접미가 «없다» → ③ 으로 내려간다(계열 결합만)
  }

  // ③ 후보가 유일할 때만 단정
  if (series.length === 1) {
    return { exact: series[0], note: `${t.areaHint}㎡대 후보 유일`, series };
  }
  return {
    exact: null,
    series,
    note: `${t.areaHint}㎡대 후보 ${series.length}종(${series.map((a) => a.toFixed(2)).join('·')}) — 접미 근거가 없어 개별 단정 불가`,
  };
}
