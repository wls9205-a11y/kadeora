// V17 G — 시공사 공식 브랜드 사이트 레지스트리 (A등급 소스).
//
// ⚠️ 설계가 바뀐 지점: 현장마다 웹 검색을 돌리면 206회다.
//    시공사 브랜드 사이트의 **「분양단지 목록」 한 장**을 긁으면 시공사 수만큼으로 끝난다.
//    한 번 조회로 여러 현장의 별칭·세대수·조감도·전용 홈페이지를 동시에 얻는다.
//
// ⚠️ 도메인을 코드 곳곳에 박지 말 것. 추가는 이 파일 한 곳에서 끝나야 한다.
//
// ── 등급 (조감도 규칙 V9 와 동일) ──
//   A  시공사 공식 브랜드 사이트 (푸터에 시공사명 + 사업자등록번호) → confidence='confirmed'
//   B  단지 전용 분양 사이트 · 언론                                → 'estimated'
//   C  분양대행 · 블로그 · 커뮤니티                                → 폐기. 큐에도 넣지 않는다
//
// ⚠️ `robots.txt` 가 막으면 그 소스는 쓰지 않는다. 우회하지 말 것.
//    2026-08-24 실측 — 아래 도메인은 전부 `Allow: /` 다.
//    차단된 곳(해링턴 마레 분양대행)은 애초에 C등급이라 목록에 없다.
//    `doosanenc.com` 은 `Disallow: /kr/` 이 있어 그 경로는 등록하지 않는다.

export interface BuilderSite {
  /** 레지스트리 키. 로그·소스 표기에 쓴다. */
  key: string;
  /** apt_sites.builder 와 대조할 시공사명. 정확 일치로만 쓴다. */
  builder: string;
  /** 브랜드명 — 단지명에 흔히 붙는다. 매칭 보조에만 쓰고 단독 근거로 쓰지 않는다. */
  brand: string;
  /** 분양단지 목록 URL. `page` 파라미터가 있으면 누적 페이징으로 본다. */
  listUrl: string;
  /** 누적 페이징 쿼리 키. 없으면 한 장만 받는다. */
  pageParam?: string;
  /**
   * 파싱 프로파일. 네 사이트가 구조가 전부 달라 하나로 안 된다 (2026-08-25 실측).
   *   'label-table' 카드 안 <th>라벨</th><td>값</td> 표        (하늘채)
   *   'plan-table'  단일 <table> 「분양계획 한눈에 보기」      (푸르지오)
   *   'data-attr'   카드의 data-* 속성에 세대수 4축            (롯데캐슬)
   *   'mobile-card' 모바일 목록의 <strong>라벨</strong><em>값</em> (더샵)
   *   'ajax-card'   POST 로 받는 목록 조각                     (두산위브)
   * 새 사이트가 다른 구조면 프로파일을 추가하고 parse.ts 에서 분기한다.
   */
  profile: 'label-table' | 'plan-table' | 'data-attr' | 'mobile-card' | 'ajax-card';
  /** 목록에서 확인한 단계. 사이트마다 분양/공사/입주 목록이 갈린다. */
  kind: 'sale' | 'construction' | 'moving';
  /** POST 로 받아야 하는 목록(ajax-card). 기본은 GET. */
  method?: 'GET' | 'POST';
  /**
   * ⚠️ 이 소스에서 **이미지를 아예 쓰지 않는 이유**. 값이 있으면 조감도 수집을 통째로 건너뛴다.
   *    빈 결과를 "수집했다" 고 기록하지 않기 위해 이유를 코드에 남긴다.
   */
  noImageReason?: string;
  /**
   * ⚠️ **목록에만** 이미지가 없는 이유. noImageReason 과 다르다 —
   *    이 값이 있으면 목록 이미지는 쓰지 않되 **전용 홈페이지 경로는 계속 탄다.**
   *
   *    둘을 한 필드로 묶어 놨더니 푸르지오가 통째로 막혀 있었다. 실측하면
   *    분양계획 표는 전용 홈페이지 링크를 주고(prugio-lakecity.com · arkone-prugio.com
   *    · prugio-riverfront.com · summitclavion.com · summitthehill.com),
   *    그중 둘은 A등급 판정(robots + 푸터 시공사명 AND 사업자등록번호)을 실제로 통과한다.
   */
  noListImageReason?: string;
  /**
   * 조감도 후보를 고를 때 `/upload/` 경로만 볼지.
   *
   * ⚠️ 기본 true 는 **하늘채 기준**이다. 그 사이트는 사진이 전부 `/upload/` 아래라
   *    로고·아이콘·배너를 그 한 줄로 걸러낼 수 있었다.
   * ⚠️ 전용 홈페이지는 경로가 제각각이다(실측 `/resources/img/…` · `/bon/img/…` · `/img/…`).
   *    `/upload/` 를 요구하면 후보가 **0건**이 된다 — arkone 14장 중 0, riverfront 57장 중 0.
   *    그래서 전용 홈페이지에서는 경로 대신 **크기 게이트(1200px 미만 탈락)**로 거른다.
   *    로고·버튼은 1200px 를 못 넘기고 svg·gif 는 애초에 후보가 아니다.
   */
  heroRequiresUploadPath?: boolean;
  /**
   * ⚠️ 이 소스에서 **세대수를 쓰지 않는 이유**. 값이 있으면 세대수를 저장하지 않는다.
   */
  noUnitsReason?: string;
}

/**
 * 확인된 A등급 소스.
 * ⚠️ 새로 넣기 전에 반드시 `robots.txt` 를 확인할 것. 막혀 있으면 넣지 않는다.
 */
export const BUILDER_SITES: BuilderSite[] = [
  {
    key: 'kolon-hanulche-sale',
    builder: '코오롱글로벌',
    brand: '하늘채',
    listUrl: 'https://www.ihanulche.co.kr/sale/list',
    pageParam: 'currentPage',
    profile: 'label-table',
    kind: 'sale',
  },
  {
    key: 'kolon-hanulche-construction',
    builder: '코오롱글로벌',
    brand: '하늘채',
    listUrl: 'https://www.ihanulche.co.kr/construction/list',
    pageParam: 'currentPage',
    profile: 'label-table',
    kind: 'construction',
  },
  {
    key: 'kolon-hanulche-moving',
    builder: '코오롱글로벌',
    brand: '하늘채',
    listUrl: 'https://www.ihanulche.co.kr/moving/list',
    pageParam: 'currentPage',
    profile: 'label-table',
    kind: 'moving',
  },

  /* ── ADDENDUM §3-2 (2026-08-25 구조 실측 완료) ──
   *
   * ⚠️ 지시서가 준 경로 중 **3개가 틀렸다.** 아래가 실측 확정본이다.
   *      thesharp.co.kr/sales/calendar.aspx  → 404 (에러 페이지로 리다이렉트)
   *      weveapt.co.kr 루트                   → 목록이 AJAX 라 정적 HTML 이 비어 있다
   *      prugio.com 은 /sale/plan.aspx 가 「분양계획 한눈에 보기」다
   *
   * robots 실측:
   *   prugio.com        Disallow /construction/ /membership/ /myprugio/ → /sale/ 은 허용
   *   thesharp.co.kr    Disallow /admin_sharp/ /upload/                 → ⚠️ 이미지가 /upload/ 다
   *   lottecastle.co.kr Allow: /
   *   weveapt.co.kr     Allow: /
   */
  {
    key: 'daewoo-prugio-plan',
    builder: '대우건설',
    brand: '푸르지오',
    listUrl: 'https://www.prugio.com/sale/plan.aspx',
    profile: 'plan-table',
    kind: 'sale',
    // ⚠️ 표 자체에는 이미지가 없다. 하지만 **전용 홈페이지 링크는 준다** —
    //    그래서 noImageReason(전면 차단)이 아니라 noListImageReason 이다.
    //    2026-08-25 실측: 표에서 전용 홈페이지 5곳이 나오고,
    //      arkone-prugio.com     robots 허용 · 사업자등록번호 ✓ · 「대우건설」 ✓ → A등급
    //      prugio-riverfront.com robots 허용 · 사업자등록번호 ✓ · 「대우건설」 ✓ → A등급
    //      summitclavion.com     「대우건설」 없음 → verifyBrandFooter 가 거른다(정상)
    //      prugio-lakecity.com   /gate/index.asp 인트로 게이트라 푸터가 없다 → 거른다(정상)
    noListImageReason: 'plan_table_has_no_images',
    // 전용 홈페이지는 자산 경로가 제각각이다. 경로가 아니라 크기로 거른다.
    heroRequiresUploadPath: false,
  },
  {
    key: 'lotte-castle-lots',
    builder: '롯데건설',
    brand: '롯데캐슬',
    listUrl: 'https://www.lottecastle.co.kr/aptInfo/lots/list.do',
    profile: 'data-attr',
    kind: 'sale',
    // 네 사이트 중 유일하게 목록 이미지가 실제 URL 이다.
  },
  {
    key: 'posco-thesharp-mobile',
    builder: '포스코이앤씨',
    brand: '더샵',
    // ⚠️ 모바일이다. PC 목록은 세대수를 한 축만 준다 — 모바일이 `총 A세대 (일반분양 B세대)` 를 준다.
    listUrl: 'https://m.thesharp.co.kr/pages/plan/sales.aspx',
    profile: 'mobile-card',
    kind: 'sale',
    // robots 가 /upload/ 를 막는데 이미지 경로가 /upload/prj/… 다. 우회하지 않는다.
    noImageReason: 'robots_disallow_upload',
  },
  {
    key: 'doosan-weve-complex',
    builder: '두산건설',
    brand: '위브',
    listUrl: 'https://weveapt.co.kr/lttot/lttotCompl/lttotComplexListAjax.do',
    profile: 'ajax-card',
    kind: 'sale',
    method: 'POST',
    // 목록 이미지가 data:image/jpg;base64 인라인이다. URL 이 없고 응답이 17.5MB 다.
    noImageReason: 'base64_inline_no_url',
    // `<span>세대수</span>2,088 세대` — 라벨이 하나뿐이라 전체/공급 판단 근거가 없다.
    noUnitsReason: 'single_axis_label_ambiguous',
  },
];

/**
 * 아직 등록하지 않은 후보. `robots.txt` 는 통과했지만 **목록 구조를 실측하지 않았다.**
 * 구조를 확인하고 프로파일을 정한 뒤 위 배열로 옮길 것 —
 * 구조를 모르는 채 파서를 돌리면 빈 결과를 "수집했다" 고 기록하게 된다.
 *
 * 2026-08-24 robots 실측: 전부 `Allow: /`
 *   hauterre.co.kr(포스코 오티에르) · www.thesharp.co.kr(포스코 더샵) ·
 *   weveapt.co.kr(두산위브) · poscoenc.com
 *
 * ⚠️ `doosanenc.com` 은 `Disallow: /kr/` 이라 후보에서 뺐다.
 *    **두산은 weveapt.co.kr 만 쓴다.** robots 를 우회하지 않는다.
 */
export const BUILDER_SITE_CANDIDATES = [
  'hauterre.co.kr',
  'www.thesharp.co.kr',
  'weveapt.co.kr',
  'poscoenc.com',
] as const;
