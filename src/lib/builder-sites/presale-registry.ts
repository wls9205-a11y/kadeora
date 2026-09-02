/**
 * CV-1 — 시공사 «분양예정 목록» 소스 레지스트리 (2026-09-02).
 *
 * ── registry.ts 와 무엇이 다른가 ────────────────────────────────────────────
 * 그쪽(V17 G)은 «인리치» 다. apt_sites 에 «이미 있는» 행에 이미지·별칭을 얹는다.
 * 그래서 목록에서 읽은 카드가 기존 행에 안 붙으면 «기록 없이 버려진다» —
 * 태영 데시앙 김해 외동(1,135세대)이 공식 페이지에 떠 있는데도 DB 에 없던 이유다.
 * 이 레지스트리는 반대 방향이다: 목록 → presale_candidates(스테이징) → 시드.
 *
 * ── ⛔ 이 파일에 «파서를 넣지 않는다» (R1) ─────────────────────────────────
 * registry.ts 는 사이트마다 구조가 달라 프로파일 5종으로 갈렸다. 소스가 20개가 되면
 * 그건 «조용히 썩는 지점 20개» 다 — upcoming_projects 방치의 재판이다.
 * 실측이 그대로 보여준다. 같은 태영 페이지 안에서도 표기가 갈린다:
 *     대전 유천1구역  「세대 : 994세대(공동주택 930세대, 오피스텔 64실, 총 5개동)」
 *     김해 외동      「세대수 : 1,135세대」
 *     서면 어반센트   「세대수 : 아파트 762세대, 오피스텔 69실」
 * 손파서로 이 셋을 다 맞추는 정규식은 다음 사이트에서 또 깨진다.
 * ⇒ 경로는 하나다: fetch → AI 추출(엄격 스키마) → 스키마 검증 → 스테이징.
 *    여기가 갖는 것은 «URL 과 fetch 힌트뿐» 이다.
 *
 * ── ⚠️ 새 소스를 넣기 전에 반드시 ──────────────────────────────────────────
 *   1. `robots.txt` 실측. 막혀 있으면 «넣지 않는다». 우회 금지(§8)
 *   2. 실제 목록 URL 을 «받아서» 확인. 지시서가 준 경로를 믿지 않는다 —
 *      registry.ts 선례로 지시서 경로 3개가 틀렸었다. 2026-09-02 태영도 그랬다:
 *      「부암동 데시앙(가칭) 831세대」는 분양예정에 «없다». 분양중의
 *      「서면 어반센트 데시앙」(부암동 690-8, 아파트 762+오피스텔 69=831)이고
 *      이미 DB 에 있다. 눈으로 확인하지 않은 경로는 결측을 «만들어낸다»
 *   3. `robotsCheckedAt` 에 실측일을 남긴다. 근거 없는 추가 자체가 사고다
 */

export interface PresaleSource {
  /** 레지스트리 키. `presale_candidates.source` 는 `crawl:<key>` 형이 된다. */
  key: string;
  /** apt_sites.builder 와 대조할 시공사명. canonicalBuilder 를 거쳐 쓴다. */
  builder: string;
  /** 브랜드명. 단지명에 흔히 붙는다 — 매칭 «보조» 이고 단독 근거가 아니다. */
  brand: string;
  /** 사람이 읽는 이름. 로그·다이제스트에 그대로 나간다. */
  label: string;
  listUrl: string;
  /**
   * 목록의 «성격».
   *   'presale'      분양예정 — 신규 발견의 본류
   *   'sale'         분양중  — 대부분 matched 로 떨어진다. 그래도 긁는다:
   *                  기존 행의 세대수·주소가 공식과 어긋나는 것을 여기서 잡는다
   *                  (실측: 서면 어반센트 DB 211 vs 공식 아파트 762)
   *   'construction' 공사중 — 위와 같은 이유
   * ⚠️ 'sale'·'construction' 에서 «시드를 만들지 않는다». 매칭·보강 전용이다.
   */
  kind: 'presale' | 'sale' | 'construction';
  method?: 'GET' | 'POST';
  /** POST 목록의 본문. AJAX 목록은 이 값이 필요하다. */
  body?: string;
  /** AJAX 목록이 요구하는 헤더(X-Requested-With 등). */
  headers?: Record<string, string>;
  /** 누적 페이징 쿼리 키. 없으면 한 장만 받는다. */
  pageParam?: string;
  maxPages?: number;
  /** robots.txt 를 «실제로 받아» 확인한 날. 없으면 이 소스를 돌리지 않는다. */
  robotsCheckedAt: string;
}

/**
 * 1호 = 태영 데시앙.
 *
 * 2026-09-02 실측:
 *   robots.txt        `User-agent: * / Allow: /`  → 전 경로 허용
 *   /web/complex/preSale  분양예정 4건 — 정적 HTML 에 내용이 있다(AJAX 아님)
 *   /web/complex/sale     분양중 7건
 *   /web/complex/building 공사중 5건
 *   /web/complex/schedule 분양일정 — 단지 카드 없음. 넣지 않는다
 *   /web/complex/living   응답 «0바이트». 빈 결과를 「수집했다」로 적지 않기 위해 뺀다
 */
export const PRESALE_SOURCES: PresaleSource[] = [
  {
    key: 'desian:presale',
    builder: '태영건설',
    brand: '데시앙',
    label: '태영 데시앙 분양예정',
    listUrl: 'https://www.desian.co.kr/web/complex/preSale',
    kind: 'presale',
    robotsCheckedAt: '2026-09-02',
  },
  {
    key: 'desian:sale',
    builder: '태영건설',
    brand: '데시앙',
    label: '태영 데시앙 분양중',
    listUrl: 'https://www.desian.co.kr/web/complex/sale',
    kind: 'sale',
    robotsCheckedAt: '2026-09-02',
  },
  {
    key: 'desian:building',
    builder: '태영건설',
    brand: '데시앙',
    label: '태영 데시앙 공사중',
    listUrl: 'https://www.desian.co.kr/web/complex/building',
    kind: 'construction',
    robotsCheckedAt: '2026-09-02',
  },
];

/**
 * 확장 순서 — 부울경 활동 시공사 우선. 커밋당 3~5소스씩, «실페이지 표본 게이트» 를 통과한 것만.
 * ⛔ 여기 이름이 있다고 해서 URL 을 «추측해» PRESALE_SOURCES 로 옮기지 말 것.
 *    옮기기 전에 robots 실측 + 목록 URL 실측 + 표본 추출 확인이 전부 있어야 한다.
 */
export const PRESALE_SOURCE_BACKLOG = [
  'GS 자이', '현대·현대ENG 힐스테이트', 'DL e편한세상', '삼성 래미안', 'HDC 아이파크',
  '한화 포레나', '호반써밋', '동원개발 비스타동원', '동일 스위트', '아이에스동서 에일린의뜰',
  '반도유보라', '중흥S클래스', '제일풍경채', '금강 펜테리움', '한신더휴', '쌍용', '서희',
  '극동', '대성문',
] as const;
