/**
 * PV-3a — 인허가 ↔ apt_sites 매칭 «판정만» 한다 (안건 ③·⑤ 확정본).
 *
 * ── 왜 기존 match_apt_site 를 쓰지 않는가 ──────────────────────────────────
 * `match_apt_site(p_text)` 는 «이름 색인» 이다. 2026-08-29 게이트가 그 축이
 * 무너지는 것을 실측으로 보여줬다:
 *   · 아실 「그랑라크 에일린의 뜰」(야음동 1,521세대)의 인허가 원문은
 *     「울산 남구 B-14 주택재개발 정비사업」이다 — 브랜드도 사업명도 아닌 «구역명».
 *     이름 축으로는 «어떤 문자열로도» 닿지 않았고, 세대수 1,521 만이 연결고리였다.
 *   · 반대로 느슨한 이름 매칭은 「문수로대공원 에일린의 뜰」(신정동 384세대)을
 *     그랑라크로 «잡아버렸다». 브랜드 한 조각이 겹쳤을 뿐인 다른 현장이다.
 * ⛔ 그래서 여기서는 **이름 단독으로는 절대 matched 가 나오지 않는다**.
 *    지번과 세대수가 1순위이고, 이름은 «둘 중 하나가 약할 때 거드는» 보조축이다.
 *
 * ── 승계하는 원칙 ─────────────────────────────────────────────────────────
 * a5_entity_link 의 「2건 이상이면 null」을 그대로 가져온다.
 * 억지로 하나 고르면 «틀린 현장에 인허가가 붙는다» — 애매한 것은 review 로 보낸다.
 *
 * ⚠️ RULES#143. 이 파일은 판정만 한다. DB 접근·upsert 는 PV-3b 라우트가 한다.
 */

/** 인허가 쪽 사실 — apt_permits 정규화분에서 온다. */
export interface PermitFact {
  /** 법정동 10자리(시군구5+법정동5). 있으면 «이것이» 지역 판정의 근거다. */
  bjdCd?: string | null;
  /** 지번 주소 원문. 「… 야음동 350-5번지」 형태. */
  address?: string | null;
  /** 사업명·구역명. 브랜드가 아닐 수 있다 — 그것이 정상이다. */
  name?: string | null;
  units?: number | null;
  /** YYYYMMDD 또는 YYYY-MM-DD. */
  permitDate?: string | null;
  /** PV2-B1: 구역 토큰 축이 쓰는 «구» 스코프. 법정동이 없을 때의 유일한 지역 근거다. */
  sigungu?: string | null;
}

/** apt_sites 쪽 후보. names 는 name·display_name·name_variants 를 합친 것. */
export interface SiteFact {
  id: string;
  bjdCd?: string | null;
  address?: string | null;
  names: string[];
  units?: number | null;
  /** PV2-B1: 정비사업 현장은 주소가 «조합 사무실» 이라 동이 안 나온다. 그때의 지역 근거. */
  sigungu?: string | null;
}

export type MatchStatus = 'matched' | 'review' | 'unmatched';

/** apt_permits.match_method 에 그대로 들어간다. 어휘를 여기서 고정한다. */
export type MatchMethod =
  | 'jibun_exact'    // 지번 본번+부번 정확일치
  | 'units_exact'    // 같은 법정동 + 세대수 정확일치
  | 'units_name'     // 같은 법정동 + 세대수 ±15% + 이름 보조 일치
  | 'units_only'     // 같은 법정동 + 세대수 ±15% 단독 → review
  | 'name_only'      // 이름만 겹침 → «절대 matched 아님» → review
  | 'units_zone'     // 같은 시군구 + 구역 토큰 일치 + 세대수 ±15% (PV2-B4)
  | 'zone_only'      // 같은 시군구 + 구역 토큰 일치 단독 → review (PV2-B1)
  | 'none';

export interface MatchVerdict {
  status: MatchStatus;
  method: MatchMethod;
  siteId: string | null;
  /** 0~1. 큐 정렬용이지 판정 근거가 아니다 — 판정은 method 가 한다. */
  score: number;
  note: string;
}

/** 지번 한 벌. 「산145」의 산도 구분한다 — 산번지는 «다른 땅» 이다. */
export interface Jibun {
  dong: string;
  san: boolean;
  bon: number;
  bu: number;
}

const UNITS_TOLERANCE = 0.15;

/**
 * 지번 파싱. 꼬리에서 「(산)본번(-부번)(번지)」를 떼고, 그 앞 토큰을 법정동으로 본다.
 *
 * ⚠️ 「… 강동동 블록」·「… 서사리 블록」처럼 «지번이 없는» 원문이 실제로 온다
 *    (에코델타시티·택지지구는 블록 단위로 허가가 난다). 이때는 null 을 준다 —
 *    0 이나 빈 지번으로 채우면 서로 다른 블록이 «같은 지번» 으로 붙는다.
 */
export function parseJibun(addr?: string | null): Jibun | null {
  if (!addr) return null;
  // PV2-B1: 꼬리를 «턴 뒤» 판다. 우리 쪽 주소는 「… 480-31번지 일대」·「… 10-1번지 외 13필지」
  //   처럼 꼬리가 붙어 오고, 인허가 쪽은 「… 480-31번지」로 깔끔하다. 그 한 낱말 때문에
  //   지번축이 통째로 죽고 있었다 — 실측: 창원 한신더휴 메가센텀(회원동 480-31)과
  //   포레나힐스테이트 진주(이현동 10-1)가 같은 지번인데도 「후보 없음」이었다.
  // ⛔ 지번 «자체» 는 느슨하게 하지 않는다. 동·산·본번·부번은 그대로 전부 같아야 한다.
  const cleaned = addr
    .trim()
    .replace(/\([^)]*\)\s*$/, '')                       // 끝의 괄호 설명
    .replace(/\s*(?:일원|일대)\s*$/, '')
    .replace(/\s*(?:외|등)\s*\d+\s*필지\s*$/, '')
    .replace(/\s*,?\s*(?:지하)?\d+\s*층\s*$/, '')      // 「… 785-8번지, 1층」
    .replace(/\s*(?:일원|일대)\s*$/, '')
    .trim();
  // ⚠️ 동과 번지 사이 공백이 «없는» 표기도 온다(「칠산동246번지」). \s* 로 받는다.
  const m = cleaned
    .match(/(?:^|\s)([가-힣]+(?:동|리|가))\s*(산)?(\d+)(?:-(\d+))?\s*(?:번지)?\s*$/);
  if (!m) return null;
  return {
    dong: m[1],
    san: Boolean(m[2]),
    bon: Number(m[3]),
    bu: m[4] ? Number(m[4]) : 0,
  };
}

/** 지번 동일성. 동·산 여부·본번·부번이 «전부» 같아야 한다. */
export function jibunEqual(a: Jibun | null, b: Jibun | null): boolean {
  if (!a || !b) return false;
  return a.dong === b.dong && a.san === b.san && a.bon === b.bon && a.bu === b.bu;
}

/**
 * 법정동 이름만 뽑는다 — 지번이 «없어도» 된다.
 * ⚠️ apt_sites 쪽 주소는 「울산광역시 남구 야음동」처럼 동까지만인 경우가 흔하다.
 *    지번 파서에만 의존하면 그 현장들이 통째로 「지역 불명」이 되어 탈락한다.
 */
export function extractDong(addr?: string | null): string | null {
  if (!addr) return null;
  const m = [...addr.matchAll(/([가-힣]+(?:동|리|가))(?=\s|$|\d)/g)];
  return m.length ? m[m.length - 1][1] : null;
}

/** 같은 지역인가. 법정동코드가 양쪽에 있으면 그것이 우선, 없으면 동 이름. */
export function sameRegion(p: PermitFact, s: SiteFact): boolean {
  if (p.bjdCd && s.bjdCd) return p.bjdCd === s.bjdCd;
  const pd = extractDong(p.address);
  const sd = extractDong(s.address);
  return Boolean(pd && sd && pd === sd);
}

/**
 * 세대수 근접도. 0(완전 불일치) ~ 1(정확일치).
 * ⚠️ 한쪽이라도 모르면 0 이 아니라 null 이다 — 「모르는 것」과 「다른 것」은 다르다.
 */
export function unitsCloseness(a?: number | null, b?: number | null): number | null {
  if (!a || !b || a <= 0 || b <= 0) return null;
  const diff = Math.abs(a - b) / Math.max(a, b);
  return diff > UNITS_TOLERANCE ? 0 : 1 - diff / UNITS_TOLERANCE;
}

/** 비교용 정규화 — 공백·괄호·「제」·차수 표기를 털어낸다. */
export function normalizeName(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(/[()（）\[\]]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/(주택)?(재개발|재건축)?정비사업(조합)?/g, '')
    .replace(/(신축)?공사$/g, '')
    .replace(/아파트$|공동주택$|주상복합$|주거복합$/g, '');
}

/**
 * 이름 보조 판정. «구역명 축» 을 본다 — 「B-14」·「27블럭」·「내이3지구」처럼
 * 브랜드가 아닌 식별자가 실제 연결고리인 경우가 많다.
 *
 * ⛔ 이 함수의 true 는 «단독으로 matched 를 만들지 못한다». 세대수나 지번이 함께 서야 한다.
 */
export function nameSupports(p: PermitFact, s: SiteFact): boolean {
  const codes = extractZoneCodes(p.name);
  // ⛔ 지역 낱말을 «먼저 턴다». 「밀양 내이동 공동주택」과 「밀양 내이동 2차」는
  //    지역이 겹칠 뿐인데, 그걸 이름 근거로 세면 sameRegion 을 두 번 세는 셈이 된다.
  //    같은 동 안의 서로 다른 현장이 전부 「이름이 거든다」가 되어 버린다.
  const pn = coreName(p.name, p.address);
  for (const raw of s.names) {
    // 구역 식별자가 양쪽에 다 있으면 그것이 이름 일치보다 강한 신호다.
    const sCodes = extractZoneCodes(raw);
    if (codes.length && sCodes.length && codes.some((c) => sCodes.includes(c))) return true;
    const sn = coreName(raw, s.address);
    if (!pn || !sn) continue;
    if (pn === sn) return true;
    if (sn.length >= 3 && pn.includes(sn)) return true;
    if (pn.length >= 3 && sn.includes(pn)) return true;
  }
  return false;
}

/**
 * 지역 낱말을 턴 «고유부». 시·도·시군구·법정동 이름을 빼고 남는 것이 진짜 이름이다.
 * 남는 것이 2자 미만이면 «이름 근거가 없다» 는 뜻이므로 빈 문자열을 준다.
 */
export function coreName(name?: string | null, addr?: string | null): string {
  let t = normalizeName(name);
  if (!t) return '';
  const dong = extractDong(addr) ?? extractDong(name);
  const words = [dong, ...(addr ?? '').split(/\s+/)].filter(Boolean) as string[];
  for (const w of words) {
    const n = normalizeName(w);
    if (n.length >= 2) t = t.split(n).join('');
  }
  t = t.replace(/^(울산광역시|부산광역시|경상남도|울산|부산|경남)/, '');
  // ⚠️ 「…시·군·구」를 «일반 규칙» 으로 털면 「무동지구」의 '구' 까지 물어 뜯는다.
  //    지역 낱말은 위의 주소 토큰 루프가 «실제로 그 주소에 있는 것만» 지운다.
  t = t.replace(/(광역시|특별시)/g, '');
  return t.length >= 2 ? t : '';
}

/**
 * 구역 식별자 추출 — 「B-14」「A3블록」「27블럭」「내이3지구」「명지2」.
 * ⚠️ 블록 번호가 «다르면» 다른 현장이다. 무동지구 14블럭과 27블럭은 남남이다.
 */
export function extractZoneCodes(s?: string | null): string[] {
  if (!s) return [];
  const out = new Set<string>();
  const t = s.toUpperCase().replace(/\s+/g, '');
  // ⚠️ 「1BL 2롯트」의 'L2' 처럼 «단어 중간» 을 식별자로 오독하지 않도록 경계를 건다.
  for (const m of t.matchAll(/(?<![A-Z0-9])([A-Z])-?(\d{1,3})(?:BL|블록|블럭)?(?![0-9])/g)) out.add(`${m[1]}${Number(m[2])}`);
  for (const m of t.matchAll(/(?<![A-Z0-9])(\d{1,3})(?:BL|블록|블럭)/g)) out.add(`BL${Number(m[1])}`);
  // ⚠️ 앞 글자를 «딱 두 자» 문다. `[가-힣]+` 면 「밀양시내이3지구」를 통째로 삼키고,
  //    `{2,3}?` 여도 정규식은 «가장 왼쪽» 부터 무는 탓에 「시내이3지구」가 된다.
  //    두 자로 고정하면 양쪽 표기가 «같은 키» 로 떨어진다 — 그것이 이 함수의 목적이다.
  for (const m of t.matchAll(/([가-힣]{2})(\d{1,2})지구/g)) out.add(`${m[1]}${Number(m[2])}지구`);
  return [...out];
}

/**
 * PV2-B1 — «구역 토큰» 추출. 「대연8」·「서금사5」·「광안A」·「금곡2-1」.
 *
 * ── 왜 두 번째 축이 필요한가 (2026-09-05 실측) ──────────────────────────────
 * 후보는 지금까지 «법정동 색인 하나» 로만 뽑았다. 그런데 부울경 공고 전 활성 현장
 * 346 중 306(88%)이 `dong` 결측이다 — 부산시 정비사업 API 가 위치 필드를 안 주고,
 * 그 현장들의 `address` 는 「가마실로 19, 2층」 같은 **조합 사무실 주소**라
 * `extractDong` 도 실패한다. 그래서 「대연8 재개발」은 색인에 «실리지도» 않았다.
 * 미매칭 70건의 다수는 못 찾은 게 아니라 «후보에 오르지도 못한» 것이다.
 *
 * 반면 이름은 양쪽이 같은 말을 쓴다:
 *   인허가 「대연8구역재개발공동주택」 ↔ 현장 「대연8 재개발」
 *   인허가 「부산광역시 서·금사 재정비촉진6구역 …」 ↔ 현장 「서금사재정비촉진6구역 재개발」
 *
 * ── 접두를 «고정 길이로» 자르지 않는다 ─────────────────────────────────────
 * ⚠️ 「부산광역시서금사재정비촉진6구역」에서 앞 2자를 물면 「금사6」, 4자면 「시서금사6」이
 *    나온다. 어느 쪽으로 고정해도 한쪽 표기가 어긋난다(기존 `extractZoneCodes` 의 지구
 *    주석이 남긴 함정과 같은 종). 그래서 **2·3·4자 접미 변형을 전부 낸다** —
 *    양쪽이 같은 변형을 하나라도 공유하면 그것이 연결이다.
 *    (「서금사6」은 3자 변형에서, 「회원2」는 2자 변형에서 만난다.)
 * ⛔ 숫자·영문 식별자가 «없는» 이름(「반월구역」·「문화구역」)은 토큰을 내지 않는다.
 *    번호 없는 동명 한 낱말은 같은 구 안에서 여러 사업을 가리켜 오매칭의 온상이다.
 */
export function extractZoneTokens(s?: string | null): string[] {
  if (!s) return [];
  // 「서·금사」의 가운뎃점처럼 표기만 다른 구분자를 턴다. 공백도 같이 턴다.
  const t = s.replace(/[·ㆍ・\s()（）\[\]]/g, '');
  const out = new Set<string>();
  const push = (run: string, id: string) => {
    if (!id) return;
    for (const n of [2, 3, 4]) {
      if (run.length >= n) out.add(`${run.slice(run.length - n)}${id}`);
    }
  };
  // ⓐ 재정비촉진N구역 — 「서금사재정비촉진6구역」
  for (const m of t.matchAll(/([가-힣]{2,8})재정비촉진(\d{1,2}|[A-Z])구역/g)) push(m[1], m[2]);
  // ⓑ 동명+번호+구역 — 「대연8구역」·「금곡2-1구역」
  for (const m of t.matchAll(/([가-힣]{2,8})(\d{1,2}(?:-\d{1,2})?)구역/g)) push(m[1], m[2]);
  // ⓒ 동명+번호+재개발/재건축 — 「범천4재개발」(구역 글자가 없는 표기)
  for (const m of t.matchAll(/([가-힣]{2,8})(\d{1,2}(?:-\d{1,2})?)(?:주택)?(?:재개발|재건축)/g)) push(m[1], m[2]);
  // ⓓ 동명+영문 식별자 — 「광안A 재개발」·「서금사A구역」
  for (const m of t.matchAll(/([가-힣]{2,8})([A-Z])(?:구역|(?:주택)?(?:재개발|재건축))/g)) push(m[1], m[2]);
  // ⓔ «머리» 토큰 — 이름의 첫 덩어리가 「동명+번호」면 그것이 구역명이다.
  //    「괴정5(시범생활권) 재개발」처럼 번호 뒤에 괄호 설명이 끼면 ⓑ·ⓒ 가 닿지 않는다.
  //    ⛔ 머리에만 적용한다. 문자열 아무 데서나 「동명+번호」를 주우면
  //       「…정비사업(2단지)」의 '사업2' 같은 쓰레기가 쏟아진다.
  const head = (s.trim().split(/[\s(（\[]/)[0] ?? '').replace(/[·ㆍ・]/g, '');
  const hm = head.match(/^([가-힣]{2,8})(\d{1,2}(?:-\d{1,2})?)$/);
  if (hm) push(hm[1], hm[2]);
  return [...out];
}

/** 같은 시군구인가. 구역 토큰 축의 «유일한» 지역 근거다. */
export function sameSigungu(p: PermitFact, s: SiteFact): boolean {
  const a = (p.sigungu ?? '').trim();
  const b = (s.sigungu ?? '').trim();
  return Boolean(a && b && a === b);
}

/** 구역 토큰을 공유하는가. ⛔ 시군구가 같을 때만 의미가 있다 — 「대연8」은 남구 안에서만 유일하다. */
export function zoneTokenShared(p: PermitFact, s: SiteFact): boolean {
  const pt = extractZoneTokens(p.name);
  if (pt.length === 0) return false;
  const set = new Set(pt);
  for (const n of s.names) {
    if (extractZoneTokens(n).some((t) => set.has(t))) return true;
  }
  return false;
}

/**
 * 안건 ③ — 백필 시간창. 창 밖이라고 «버리지 않는다».
 * 원문 보존이 스테이징의 존재 이유고, 버리면 「API 커버에 있었는지」조차 모르게 된다.
 * 판정은 통과시키고 표기만 남긴다(match_note 의 out_of_window).
 */
export function isOutOfWindow(permitDate?: string | null, asOf = new Date(), months = 36): boolean {
  if (!permitDate) return false; // 모르면 «밖» 이라고 단정하지 않는다
  const d = permitDate.replace(/-/g, '');
  if (!/^\d{8}$/.test(d)) return false;
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)));
  const cut = new Date(asOf);
  cut.setMonth(cut.getMonth() - months);
  return t < cut.getTime();
}

/** 후보 하나에 대한 판정. 지역이 다르면 «이름이 같아도» 여기서 끝난다. */
function judgeOne(p: PermitFact, s: SiteFact): MatchVerdict {
  const none: MatchVerdict = { status: 'unmatched', method: 'none', siteId: null, score: 0, note: '' };
  // PV2-B1: 지역 근거가 «둘» 이 됐다. 법정동(기존)이거나, 같은 시군구 안의 구역 토큰이거나.
  // ⛔ 시군구만 같은 것은 지역 근거가 아니다 — 구역 토큰이 «함께» 서야 한다.
  //    구 하나에 현장이 수십 개다. 토큰 없이 구를 열면 세대수 우연일치가 쏟아진다.
  const regionOk = sameRegion(p, s);
  const zoneOk = sameSigungu(p, s) && zoneTokenShared(p, s);
  if (!regionOk && !zoneOk) return none;

  const pj = parseJibun(p.address);
  const sj = parseJibun(s.address);
  if (jibunEqual(pj, sj)) {
    return { status: 'matched', method: 'jibun_exact', siteId: s.id, score: 1, note: `지번 정확일치 ${pj!.dong} ${pj!.bon}${pj!.bu ? '-' + pj!.bu : ''}` };
  }

  const u = unitsCloseness(p.units, s.units);
  const nameOk = nameSupports(p, s);

  if (regionOk && u === 1) {
    return { status: 'matched', method: 'units_exact', siteId: s.id, score: 0.95, note: `같은 법정동 + 세대수 정확일치 ${p.units}` };
  }
  // PV2-B4: 구역 토큰이 같고 세대수가 ±15% 안이면 확정으로 올린다.
  // 구역명은 그 구 안에서 유일한 식별자이고, 세대수가 그것을 «두 번째 축» 으로 받친다.
  if (zoneOk && u !== null && u > 0) {
    return { status: 'matched', method: 'units_zone', siteId: s.id, score: 0.85, note: `구역 토큰 일치 + 세대수 ±15%(${p.units}/${s.units})` };
  }
  if (u !== null && u > 0 && nameOk) {
    return { status: 'matched', method: 'units_name', siteId: s.id, score: 0.8 + 0.1 * u, note: `세대수 ±15%(${p.units}/${s.units}) + 이름 보조` };
  }
  if (u !== null && u > 0) {
    return { status: 'review', method: 'units_only', siteId: s.id, score: 0.5 + 0.2 * u, note: `세대수 ±15%(${p.units}/${s.units}) 단독 — 이름 근거 없음` };
  }
  if (nameOk) {
    // ⛔ 오늘의 실패가 여기다. 이름만으로는 «절대» matched 를 주지 않는다.
    return { status: 'review', method: 'name_only', siteId: s.id, score: 0.3, note: '이름만 겹침 — 지번·세대수 근거 없음' };
  }
  // PV2-B1: 구역 토큰이 같은데 세대수가 모르거나 어긋난다. ⛔ 확정하지 않지만 «버리지도» 않는다.
  // ⚠️ 이 문은 regionOk 여부와 무관하게 «마지막» 에 선다. 처음엔 !regionOk 안에 뒀는데,
  //    법정동까지 같은데 세대수만 어긋나는 경우(중동5: 972 vs 1149, 15.4%)가 오히려
  //    그 가지에 못 들어와 통째로 unmatched 로 떨어졌다 — 근거가 «더 많은» 쪽이 탈락했다.
  if (zoneOk) {
    return { status: 'review', method: 'zone_only', siteId: s.id, score: 0.45, note: `구역 토큰 일치 — 세대수 근거 없음(${p.units ?? '?'}/${s.units ?? '?'})` };
  }
  return none;
}

/**
 * 후보군 전체 판정.
 * ⛔ matched 가 2건 이상이면 «전부 review» 다. 하나를 고르는 순간 틀릴 확률이 절반이다.
 */
export function judgeMatch(p: PermitFact, sites: SiteFact[]): MatchVerdict {
  const verdicts = sites.map((s) => judgeOne(p, s)).filter((v) => v.method !== 'none');
  if (verdicts.length === 0) {
    return { status: 'unmatched', method: 'none', siteId: null, score: 0, note: '후보 없음' };
  }
  const matched = verdicts.filter((v) => v.status === 'matched').sort((a, b) => b.score - a.score);
  if (matched.length === 1) return matched[0];
  if (matched.length > 1) {
    return {
      status: 'review',
      method: matched[0].method,
      siteId: null,
      score: matched[0].score,
      note: `matched 후보 ${matched.length}건 — 억지로 고르지 않는다 (${matched.map((v) => v.siteId).join(', ')})`,
    };
  }
  return verdicts.sort((a, b) => b.score - a.score)[0];
}
