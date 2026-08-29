/**
 * 시공사 «표기 사전» — canonical + variants (중단점 B 판정 1-① · 2026-08-29 신설).
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * PV-5 첫 배치에서 「대신 해모로 센트럴 2차」가 conflicting 으로 떨어졌다.
 * 갈린 값이 **한진중공업 vs HJ중공업** — 같은 회사다(2021년 사명 변경).
 * 표기가 둘이면 「출처가 갈렸다」로 읽히고, 검수 큐가 «사명 변경 이력» 으로 찬다.
 *
 * ⛔ 문자열 유사도로 합치지 «않는다». 사전에 «등재된 것만» 합친다 —
 *    유사도로 묶으면 「대우건설 ↔ 대우조선해양」 같은 남의 회사가 붙는다.
 * ⚠️ 이 표는 «자란다». 검수 큐에서 사명 변경이 확인될 때마다 한 줄씩 등재한다.
 *    근거 없이 추가하지 않는다 — 등재 자체가 판정이다.
 */

/** canonical → 그 회사를 가리키는 다른 표기들. canonical 은 «현재 사명» 이다. */
export const BUILDER_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // 1호 등재 — PV-5 첫 배치 실측(2026-08-29). 2021.3 사명 변경.
  'HJ중공업': ['한진중공업', '한진중공업건설', 'HJ 중공업'],
  // 아래는 널리 알려진 사명 변경. 검수에서 반례가 나오면 «빼는» 것도 등재다.
  'DL이앤씨': ['대림산업', '대림건설', 'DL 이앤씨', 'DL E&C'],
  '포스코이앤씨': ['포스코건설', '포스코 이앤씨', 'POSCO건설'],
  'HDC현대산업개발': ['현대산업개발', 'HDC 현대산업개발'],
  '한화': ['한화건설'],
  'DL건설': ['삼호', '고려개발'],
};

/** variant(정규화) → canonical 역색인. 모듈 로드 시 한 번 만든다. */
const INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canon, variants] of Object.entries(BUILDER_ALIASES)) {
    m.set(normalizeBuilder(canon), canon);
    for (const v of variants) m.set(normalizeBuilder(v), canon);
  }
  return m;
})();

/** 비교용 정규화 — 공백·괄호·「(주)」·「주식회사」를 턴다. */
export function normalizeBuilder(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/\(주\)|주식회사|㈜/g, '')
    .replace(/[()（）\s·,]/g, '')
    .toLowerCase();
}

/**
 * canonical 치환. 사전에 없으면 «원문을 그대로» 돌려준다 —
 * 모르는 회사를 임의로 고치지 않는다.
 */
export function canonicalBuilder(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalizeBuilder(name);
  if (!n) return null;
  return INDEX.get(n) ?? String(name).trim();
}

/** 두 표기가 «같은 회사» 인가. 사전에 등재된 관계만 참이다. */
export function sameBuilder(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = canonicalBuilder(a), cb = canonicalBuilder(b);
  if (!ca || !cb) return false;
  return normalizeBuilder(ca) === normalizeBuilder(cb);
}

// ── 역할 구분 (판정 1-②) ───────────────────────────────────────────────────
/**
 * ⛔ 「입찰·참여·후보」 문맥의 건설사는 builder «값이 아니다».
 *    PV-5 첫 배치에서 「부산 우동1 재건축」이 DL·현대·대우·삼성물산·대방·동원 6곳으로
 *    conflicting 이 됐다 — 시공사 «입찰 경쟁» 기사에서 후보를 전부 뽑은 것이다.
 *    후보를 값으로 쓰면 경쟁이 치열한 현장일수록 판정이 더 나빠진다.
 */
// ⚠️ 2026-08-30 B′ 실측으로 보강 — 「시공사로」만 있어서 «시공 계열» 3건을 버렸다:
//    「시공사인 BS한양」 「롯데건설(주)이 시공한」 「시공사는 GS건설의…」.
//    「시공사인 A」는 명백한 선정 근거다. 「~로」 하나만 넣은 것이 좁았다.
const SELECTED = [
  '선정', '수주', '계약', '낙찰', '우선협상', '지정',
  '시공사로', '시공사인', '시공사는', '시공사가', '시공한', '시공을 맡', '시공을맡', '시공사 선정',
];
const CANDIDATE = ['입찰', '참여', '후보', '경쟁', '제안', '설명회', '참가', '검토', '유력'];

export type BuilderRole = 'selected' | 'candidate' | 'unknown';

/**
 * 근거 어휘로 역할을 가른다.
 * ⚠️ 후보 어휘가 «하나라도» 있으면 candidate 다 — 「입찰에 참여해 선정됐다」처럼
 *    둘이 섞인 문장은 사람이 봐야 한다. 안전한 쪽으로 접는다.
 */
export function builderRole(evidence: string | null | undefined): BuilderRole {
  const t = String(evidence ?? '');
  if (!t) return 'unknown';
  if (CANDIDATE.some((w) => t.includes(w))) return 'candidate';
  if (SELECTED.some((w) => t.includes(w))) return 'selected';
  return 'unknown';
}

/** builder 주장으로 «채택할» 수 있는가. selected 만 값이 된다. */
export function acceptAsBuilder(evidence: string | null | undefined): boolean {
  return builderRole(evidence) === 'selected';
}

// ── 수치 결합 검증 (판정 1-③) ──────────────────────────────────────────────
/**
 * ⛔ 「78」 같은 맨숫자를 세대수로 받지 «않는다».
 *    PV-5 첫 배치에서 양정4 가 78 vs 849 로 갈렸다 — 78 은 세대수가 아니었다.
 *    숫자와 「세대」가 «결합» 된 것만 값으로 본다.
 * ⚠️ 「849세대」 「849 세대」 「총 849세대」 「1,000가구」 는 통과,
 *    「78」 「78억」 「78㎡」 는 탈락. ⛔ 「호」는 받지 않는다 — 오피스텔 호실과 섞인다.
 */
export function parseUnits(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const t = String(raw);
  // 숫자만 온 경우 — 결합 근거가 없으므로 버린다.
  if (/^\s*[\d,]+\s*$/.test(t)) return null;
  // ⚠️ 2026-08-30 B′ 실측 — 「세대」만 받아 「1,000가구」·「1850가구」·「299가구」를 버렸다.
  //    한국 기사에서 아파트 세대수는 「세대」만큼이나 «가구» 로 쓴다. 둘 다 받는다.
  //    ⛔ 「호」는 넣지 않는다 — 오피스텔·호실 수와 섞인다(다른 사실이다).
  const m = t.match(/([\d,]{2,7})\s*(?:세대|가구)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  // 30세대 미만·현실 밖 값은 세대수로 보지 않는다(§6 필터와 같은 결).
  return Number.isFinite(n) && n >= 30 && n <= 20_000 ? n : null;
}
