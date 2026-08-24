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
   * 파싱 프로파일.
   *   'label-table' — 카드 안에 <th>라벨</th><td>값</td> 표가 있는 형태 (하늘채 실측)
   * 새 사이트가 다른 구조면 프로파일을 추가하고 parse.ts 에서 분기한다.
   */
  profile: 'label-table';
  /** 목록에서 확인한 단계. 사이트마다 분양/공사/입주 목록이 갈린다. */
  kind: 'sale' | 'construction' | 'moving';
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
];

/**
 * 아직 등록하지 않은 후보. `robots.txt` 는 통과했지만 **목록 구조를 실측하지 않았다.**
 * 구조를 확인하고 프로파일을 정한 뒤 위 배열로 옮길 것 —
 * 구조를 모르는 채 파서를 돌리면 빈 결과를 "수집했다" 고 기록하게 된다.
 *
 * 2026-08-24 robots 실측: 전부 `Allow: /`
 *   hauterre.co.kr(포스코 오티에르) · www.thesharp.co.kr(포스코 더샵) ·
 *   weveapt.co.kr(두산위브) · poscoenc.com
 *   doosanenc.com 은 `Disallow: /kr/` — 한국어 경로를 쓰려면 다른 경로를 찾아야 한다.
 */
export const BUILDER_SITE_CANDIDATES = [
  'hauterre.co.kr',
  'www.thesharp.co.kr',
  'weveapt.co.kr',
  'poscoenc.com',
] as const;
