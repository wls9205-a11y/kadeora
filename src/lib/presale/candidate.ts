/**
 * CV-2 — 분양예정 후보의 «판정만» 한다 (2026-09-02).
 *
 * ⚠️ Rule #116. 이 파일은 DB 를 모른다. fetch·AI·upsert 는 라우트가 한다.
 *
 * ── 이 파일이 지키는 두 문장 ────────────────────────────────────────────────
 * ⛔ **확신이 없으면 만들지 않는다 — 다만 버리지도 않는다.** 기준 미달은 `queued` 다.
 * ⛔ **모르는 공급유형에는 광고를 걸지 않는다.** 페이지는 만들되 광고에서 뺀다(R2).
 */
import { slugDupKey, generateAptSlugStrict } from '@/lib/apt-slug';

export type SupplyType = '민영' | '공공' | '임대' | '미상';

/** 후보 한 벌 — AI 추출이 뱉고 스키마 검증을 통과한 형태. */
export interface CandidateFact {
  rawName: string;
  addrRaw?: string | null;
  region?: string | null;
  sigungu?: string | null;
  totalUnits?: number | null;
  builderRaw?: string | null;
  expectedPeriodRaw?: string | null;
  sourceUrl: string;
  /** 'presale' 만 시드 후보다. 'sale'·'construction' 은 매칭·보강 전용. */
  kind: 'presale' | 'sale' | 'construction';
}

/** 비교·중복 판정 키. ⚠️ DB 표현식 인덱스와 «같은 규칙» 이어야 한다. */
export const normName = (s: string | null | undefined): string => slugDupKey(s ?? '');

// ── 가칭 규약 (R6) ──────────────────────────────────────────────────────────
/**
 * 「(가칭)」류 꼬리를 «떼어낸다».
 *
 * ⚠️ 화면에 쓰는 이름(display_name)에서는 «떼지 않는다» — 「부암동 데시앙(가칭)」이
 *    맞는 표기다. 떼는 것은 slug 를 만들 때뿐이다. 붙인 채로 slug 를 만들면
 *    `부암동-데시앙가칭` 이 되고, 확정명이 나오는 날 리다이렉트 대상이 «괄호 낀 URL» 이 된다.
 * ⚠️ 키워드(kw_name)는 괄호 제거로 이미 정화된다(sa.py 실측 확인). 여기서 맞추는 것은
 *    «착지 URL» 쪽이다 — PL 착지 canonical 대조 v1.1 ①.
 */
export function stripProvisional(name: string): string {
  return String(name ?? '')
    .replace(/\s*[（(]\s*(가칭|가제|임시명|잠정)\s*[）)]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 「(가칭)」이 붙어 있는가. 검수 큐 표시·확정명 승격 대상 판별에 쓴다. */
export const isProvisional = (name: string): boolean =>
  /[（(]\s*(가칭|가제|임시명|잠정)\s*[）)]/.test(String(name ?? ''));

/**
 * 새 현장의 slug. ⚠️ 새로 만드는 레코드 전용 규칙(strict)에 가칭 제거를 «먼저» 건다.
 *   「부암동 데시앙(가칭)」 → `부암동-데시앙`
 */
export const provisionalSlug = (name: string): string =>
  generateAptSlugStrict(stripProvisional(name));

// ── 공급유형 게이트 (R2) ────────────────────────────────────────────────────
/**
 * ⛔ 「모르면 전부 미상」으로 두지 «않는다». 그렇게 하면 기존·신규 통틀어 광고가 꺼진다.
 *    R2 가 막으려는 것은 «이름 정규식 필터를 통과해 광고에 실리는 공공 블록» 이다
 *    (명지 A5 실증). 그래서 «차단어와 블록 패턴을 명시»하고, 나머지는 민영으로 둔다.
 *
 * 2026-09-02 태영 실측이 세 갈래를 전부 보여줬다:
 *   「고창 덕산지구 공동주택(공공분양)」   → 공공  (명시 차단어)
 *   「화성동탄2A78BL공공주택사업」          → 공공  (명시 차단어)
 *   「부산 명지 A5」                        → 미상  (블록 패턴 · 브랜드 없음)
 *   「거제 옥포 공동주택」                  → 미상  (사업유형·브랜드 어느 표지도 없음)
 *   「김해 외동 재건축사업」                → 민영  (재건축 표지)
 *   「대전 유천1구역 지역주택조합」         → 민영  (지주택은 민영이다)
 */
const PUBLIC_MARKERS = [
  '공공분양', '공공주택', '공공임대', '행복주택', '국민임대', '영구임대', '장기전세',
  '토지주택공사', 'LH', '도시공사', '개발공사', '주택공사',
];
const RENTAL_MARKERS = [
  '공공지원민간임대', '민간임대', '뉴스테이', '기업형임대', '임대주택', '리츠',
];
/** 「A5」「B-14」「A78BL」 — 택지지구 블록 표기. 이름이 곧 블록이면 사업 주체를 모른다. */
const BLOCK_PATTERN = /(^|[\s가-힣])[A-Za-z]-?\d{1,3}\s*(BL|블록)?($|[\s가-힣])/;
/** 민영임을 스스로 말하는 사업유형 표지. */
const PRIVATE_MARKERS = [
  '재건축', '재개발', '정비사업', '지역주택조합', '리모델링', '소규모재건축', '가로주택',
];

export function judgeSupplyType(name: string, addrRaw?: string | null, brand?: string | null): SupplyType {
  const t = `${name ?? ''} ${addrRaw ?? ''}`;
  // ⚠️ 공공을 임대보다 «먼저» 본다. 「공공임대」는 둘 다 맞지만 광고 판정은 같고,
  //    다이제스트에서 성격을 읽을 때 공공이 더 큰 분류다.
  if (PUBLIC_MARKERS.some((w) => t.includes(w))) return '공공';
  if (RENTAL_MARKERS.some((w) => t.includes(w))) return '임대';
  if (PRIVATE_MARKERS.some((w) => t.includes(w))) return '민영';
  // 브랜드(펫네임)가 붙어 있으면 민간 분양으로 본다 — 공공 블록에는 브랜드가 없다.
  if (brand && name.includes(brand)) return '민영';
  if (BLOCK_PATTERN.test(name)) return '미상';
  // 「… 공동주택」처럼 사업유형도 브랜드도 없는 이름은 «아직 모르는» 것이다.
  if (/공동주택\s*$/.test(name.trim())) return '미상';
  return '민영';
}

/** 광고 적격은 «민영만». 나머지는 페이지는 살고 키워드만 안 나간다. */
export const adBlockedFor = (t: SupplyType): boolean => t !== '민영';

// ── 지역 축 보호 ────────────────────────────────────────────────────────────
/**
 * `apt_sites.region` 이 실제로 쓰는 «17개 값». 2026-09-02 실측 — 활성 6,256행이
 * 정확히 이 17개만 쓴다. 오염 0.
 *
 * ⛔ 여기를 통과하지 못하는 값으로 «현장을 만들지 않는다».
 *    parseAddress 는 시·도를 못 알아보면 «첫 토막을 그대로» 돌려준다(폴백):
 *      「청주시 서원구 사창동 270-1번지 일원」 → region '청주시'
 *    실측 카드에 이 형태가 실제로 있었다(태영 분양예정 「청주 사창 재건축 정비사업」).
 *    그대로 앉히면 18번째 값이 생기고, 그 순간 CV-4 의 「미등록 잔량」과 sa.py 의
 *    존 필터가 «둘 다» 이 행을 못 본다 — 페이지는 있는데 지표에는 없는 상태다.
 * ⚠️ 못 알아본 것은 «버리는» 것이 아니라 queued 로 남는다. 사람이 채우면 된다.
 */
export const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

export const isKnownRegion = (r: string | null | undefined): boolean =>
  !!r && (REGIONS as readonly string[]).includes(r);

// ── 자동 시드 게이트 ────────────────────────────────────────────────────────
export interface SeedVerdict {
  seed: boolean;
  /** 시드하지 않을 때 `presale_candidates.resolution_note` 로 그대로 나간다. */
  reason: string;
}

/**
 * 미매칭 후보를 «자동 시드» 할 수 있는가 — 전부 충족해야 한다.
 *
 * ⚠️ D2(수동 시드 금지)와 충돌하지 않는다. 사람이 이름을 옮겨 적는 경로는 여전히 금지고,
 *    여기는 «소스가 말한 것» 을 소스 표기와 함께 앉히는 경로다. 그래서 source_url 이 필수다.
 * ⛔ 기준 미달은 `queued` 로 «남는다». 폐기는 사람이 rejected 로만 한다.
 */
export function seedGate(c: CandidateFact): SeedVerdict {
  if (c.kind !== 'presale') {
    return { seed: false, reason: `시드 대상 아님 — ${c.kind} 목록은 매칭·보강 전용` };
  }
  const name = stripProvisional(c.rawName).trim();
  // 식별자: 단지명 또는 「지역+블록/구역」. 두 글자짜리는 이름이 아니다.
  if (normName(name).length < 3) {
    return { seed: false, reason: `식별자 부족 — "${c.rawName}"` };
  }
  if (!c.region) {
    return { seed: false, reason: '지역 미확정 — region 없이 앉히지 않는다' };
  }
  if (!isKnownRegion(c.region)) {
    return { seed: false, reason: `지역 표기 미확정 — "${c.region}" 은 시·도가 아니다` };
  }
  if (!/^https?:\/\//.test(c.sourceUrl ?? '')) {
    return { seed: false, reason: 'source_url 없음 — 원본으로 돌아갈 수 없는 값은 앉히지 않는다' };
  }
  if (!provisionalSlug(name)) {
    return { seed: false, reason: `slug 생성 불가 — "${name}"` };
  }
  return { seed: true, reason: '' };
}

/**
 * 시드 직전 «유사명 검색» 이 필요한가를 판정하는 키.
 * 대연3 ↔ 디아이엘 재발 방지 — 라우트가 이 키로 apt_sites 를 먼저 훑고,
 * 유사 후보가 있으면 시드 «대신» 큐에 병합 제안으로 남긴다.
 */
export const similarKey = (name: string): string => normName(stripProvisional(name));

/**
 * 유사명 검색의 «지역 울타리» (CV-B ②).
 *
 * ⚠️ 매칭 풀은 그 소스의 «모든 카드» 시군구·시도를 합쳐 한 번에 읽는다. 그래서 유사명
 *    검색을 풀 전체에 걸면 다른 카드의 지역이 섞인다 — CV-A 본실행 실측: 고창(전북)
 *    카드의 「유사 현장」 후보로 창원(경남) 2건이 걸려 시드 대신 큐로 갔다.
 *    「공공분양」 같은 공통 토큰이 이름축을 통과시킨 것이고, 안전측이지만 진짜 신규가
 *    큐에서 늦어진다.
 * ⚠️ 한쪽 값이 «없으면» 막지 않는다. region 을 못 읽은 행까지 울타리로 쳐내면
 *    이미 있는 현장 옆에 새 페이지를 또 만드는, 더 비싼 실패로 되돌아간다.
 */
export const isSameArea = (
  a: { region?: string | null; sigungu?: string | null },
  b: { region?: string | null; sigungu?: string | null },
): boolean =>
  (!a.region || !b.region || a.region === b.region) &&
  (!a.sigungu || !b.sigungu || a.sigungu === b.sigungu);

/**
 * 같은 소스 «안» 의 두 카드가 같은 현장인가 (CV-B ③).
 *
 * 실측(CV-A 본실행): 태영 목록 한 장에 「화성동탄2 A78BL 공공주택사업」(사업명)과
 * 「동탄 자연&데시앙」(브랜드명)이 «따로» 올라와 있었다. 사업명 카드는 region 을 못 읽어
 * 주소축까지 못 타고 큐에 남았다 — 카드끼리는 대조하지 않기 때문이다.
 *
 * ⛔ 이 판정으로 «붙이지 않는다». 세대수+지역이 같다는 것은 같은 현장의 «강한 힌트» 일
 *    뿐이고, 같은 택지지구의 다른 블록이 같은 세대수를 쓰는 일이 있다. 큐에 메모만 남기고
 *    판단은 사람이 한다 — 자동 병합은 되돌리기 어려운 쪽의 실패다.
 * ⚠️ 세대수가 «양쪽 다» 있어야 한다. null 을 같음으로 세면 그 소스의 카드가 전부 서로
 *    후보가 된다.
 */
export const isSameSiteHint = (
  a: { region?: string | null; totalUnits?: number | null; rawName?: string },
  b: { region?: string | null; totalUnits?: number | null; rawName?: string },
): boolean => {
  if (!a.totalUnits || !b.totalUnits || a.totalUnits !== b.totalUnits) return false;
  if (a.rawName && b.rawName && normName(a.rawName) === normName(b.rawName)) return false;
  // region 은 한쪽이라도 없으면 «막지 않는다» — 못 읽은 카드가 정확히 이 힌트가 필요한 쪽이다.
  return !a.region || !b.region || a.region === b.region;
};
