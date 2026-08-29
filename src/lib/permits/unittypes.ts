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
  dongNm?: string | null;
  pngtypGbNm?: string | null;
  hoNo?: string | null;
}

export interface TypeRow {
  label: string;
  units: number;
  areaHint: number | null;
  suffix: string | null;
}

export interface TypeTable {
  building: string;
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

  for (const r of rows) {
    if (r.dongNm) dongs.add(String(r.dongNm).trim());
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
export function exclusiveAreas(rows: AreaRow[]): number[] {
  return rows
    .filter((r) => (r.exposPubuseGbCdNm ?? '').trim() === '전유')
    .filter((r) => (r.mainAtchGbCdNm ?? '').trim() === '주건축물')
    .filter((r) => /아파트|공동주택|연립|다세대/.test(String(r.purpsCdNm ?? '')))
    .map((r) => Number(r.area))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

/**
 * 타입 라벨 ↔ 실면적 매칭. 평형계열 「84A」는 84±1.5㎡ 안의 전유면적과 맞춘다.
 * ⛔ 못 맞추면 «지어내지 않는다» — null 이다. 면적을 화면에 쓰려면 근거가 있어야 한다.
 */
export function matchArea(t: TypeRow, areas: number[], tol = 1.5): number | null {
  if (t.areaHint === null) return null;
  // 면적계열이면 이미 면적이다.
  if (!Number.isInteger(t.areaHint)) return t.areaHint;
  let best: number | null = null, bestDiff = Infinity;
  for (const a of areas) {
    const d = Math.abs(a - t.areaHint);
    if (d < bestDiff) { bestDiff = d; best = a; }
  }
  return bestDiff <= tol ? best : null;
}
