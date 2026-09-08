/**
 * CV-N 골든셋 — L1(픽스처)과 L2(배포 후 실추출)가 «같은 것» 을 본다 (2026-09-08).
 *
 * 6쌍 + bid 1건. 전부 2026-09-08 웹·DB 교차검증을 거친 실재 현장이다.
 * 여기 적힌 site 스냅샷은 그날의 DB 실값이고, 매칭이 «형제 구역들 사이에서» 옳게
 * 흡착하는지를 보기 위해 혼동 유발 형제(촉진1·2-1·2-2·4, 문현5·6·7, 가야3·4·5,
 * 반여3)를 일부러 함께 넣었다. 형제가 없으면 매칭 테스트는 아무것도 증명하지 못한다.
 *
 * ⚠️ 세대수를 «기대 단일값» 으로 박지 않는다. 문현1 은 설계서가 3,813, DB 가 2,568 로
 *    갈렸고 어느 쪽이 참인지 이 자리에서 판정할 근거가 없다. 그런 값을 하드로 박으면
 *    코드가 멀쩡한데 L1 이 red 가 된다 — v1.2-A 가 막으려던 바로 그 형태다.
 *    세대수는 «있는가 · 자릿수가 말이 되는가» 로만 본다.
 */

import type { EventType, SiteLite } from './decide';

/** 2026-09-08 DB 실값 스냅샷. 매칭 판정에 필요한 필드만 담는다. */
export const GOLDEN_SITES: SiteLite[] = [
  // ── 시민공원 주변 촉진 구역들 (라로체 3각의 무대) ──
  {
    id: '69c148ec-7a30-46b4-a7d6-3104c1e8053d',
    name: '시민공원주변재정비촉진3구역 재개발',
    display_name: '부산진구 시민공원주변재정비촉진3구역 재개발',
    sigungu: '부산진구',
    builder: '디엘이엔씨',
    total_units: 3545,
    name_variants: ['시민공원주변재정비촉진3구역 재개발', '촉진3구역', '아크로 라로체', '라로체'],
    is_active: true,
  },
  {
    id: 'f411b641-cd3e-45f6-a7e1-76353bdabb31',
    name: '시민공원주변재정비촉진1구역 재개발',
    display_name: '부산진구 시민공원주변재정비촉진1구역 재개발',
    sigungu: '부산진구',
    builder: 'GS건설',
    total_units: 1874,
    name_variants: ['시민공원주변재정비촉진1구역 재개발', '촉진1구역', '서면 자이'],
    is_active: true,
  },
  {
    id: '3c4c9d38-481f-4528-90c6-d1d9e2e04e66',
    name: '시민공원주변재정비촉진2-1구역 재개발',
    sigungu: '부산진구',
    builder: '',
    total_units: 1902,
    name_variants: ['시민공원주변재정비촉진2-1구역 재개발', '오티에르 시티즌파크'],
    is_active: true,
  },
  {
    id: 'b9641a7e-6a23-4af3-9a3b-2134d6300c27',
    name: '시민공원주변재정비촉진4구역 재개발',
    sigungu: '부산진구',
    builder: '현대엔지니어링',
    total_units: 840,
    name_variants: ['시민공원주변재정비촉진4구역 재개발'],
    is_active: true,
  },

  // ── 해운대 (아크로 해운대 · 아크로 원하이드) ──
  {
    id: '68808c21-6c17-4107-a418-3343b77c3b5c',
    name: '중동5 재개발',
    display_name: '부산 해운대구 중동5 재개발',
    sigungu: '해운대구',
    builder: '', // ⚠️ 실제로 비어 있다 — N-1/N-2 가 채워야 할 표적이다
    total_units: 1149,
    name_variants: ['중동5 재개발', '중동5구역', '해운대 중동5 재개발'],
    is_active: true,
  },
  {
    id: '5b03bbd1-774e-427d-a843-a7d808c99554',
    name: '우동1 재건축',
    display_name: '부산 해운대구 우동1 재건축',
    sigungu: '해운대구',
    builder: 'DL이앤씨',
    total_units: 1476,
    name_variants: ['우동1 재건축', '우동1구역', '해운대 우동1 재건축'],
    is_active: true,
  },
  {
    id: 'f99ee93d-2b5a-46fd-adba-0c1736cf5449',
    name: '반여3 재건축',
    display_name: '부산 해운대구 반여3 재건축',
    sigungu: '해운대구',
    builder: 'DL이앤씨',
    total_units: 915,
    name_variants: ['반여3 재건축', '반여3구역', '해운대 반여3 재건축'],
    is_active: true,
  },

  // ── 문현 (BIFC 시그니처 · IFC 자이 더 스카이) ──
  {
    id: '2b49c4d3-21e7-4ed3-a359-03b76518b5ee',
    name: '문현3 재개발',
    display_name: '부산 남구 문현3 재개발',
    sigungu: '남구',
    builder: '현대엔지니어링, 두산건설',
    total_units: 2772,
    name_variants: ['문현3 재개발', '문현3구역'],
    is_active: true,
  },
  {
    id: 'b286cae6-82cb-4074-9a27-f6853b86f5c7',
    name: '문현1 재개발',
    display_name: '부산 남구 문현1 재개발',
    sigungu: '남구',
    builder: 'GS건설',
    total_units: 2568,
    name_variants: ['문현1 재개발', '문현1구역'],
    is_active: true,
  },
  {
    id: '6cd66763-5db8-4412-b321-d0241e0d7906',
    name: '문현6 재개발',
    sigungu: '남구',
    builder: '',
    name_variants: ['문현6 재개발'],
    is_active: true,
  },
  {
    id: 'd9f7e119-04d3-4bbf-b25d-fbff53b380e5',
    name: '문현7 재개발',
    sigungu: '남구',
    builder: '',
    name_variants: ['문현7 재개발'],
    is_active: true,
  },

  // ── 가야 (더 다이너스티 가야 — 합성명) ──
  {
    id: 'ef145c9d-11ee-4274-b9e1-c63f5a9bdd59',
    name: '가야1 재개발',
    display_name: '더 다이너스티 가야',
    sigungu: '부산진구',
    builder: '현대산업개발, 대우건설',
    total_units: 1943,
    name_variants: ['가야1 재개발', '가야1구역'],
    is_active: true,
  },
  {
    id: '25377733-278a-4c5a-9c30-ad4defb6418c',
    name: '가야3 재개발',
    sigungu: '부산진구',
    builder: '롯데건설',
    total_units: 935,
    name_variants: ['가야3 재개발'],
    is_active: true,
  },
  {
    id: '533aca4a-4c6c-4088-9174-7e9b84ba67d4',
    name: '가야4 재개발',
    sigungu: '부산진구',
    builder: '',
    name_variants: ['가야4 재개발'],
    is_active: true,
  },
];

export interface GoldenCase {
  key: string;
  proposedName: string;
  projectName: string;
  sigungu: string;
  eventType: EventType;
  source: string;
  sourceUrl: string;
  builderRaw?: string;
  crossRefs?: number;
  /** 기대 현장 id. null 이면 «어디에도 붙지 않아야» 한다. */
  expectSiteId: string | null;
  expectTier: 'T-A' | 'T-B' | 'T-C' | 'T-역' | null;
  expectApply: boolean;
  /** 이 후보가 실제로 표시명을 바꾼다면 그 값. 강등이면 구역명. */
  expectDisplay?: string;
  note: string;
}

export const GOLDEN_CASES: GoldenCase[] = [
  {
    key: 'acro-laroche',
    proposedName: '아크로 라로체',
    projectName: '시민공원주변재정비촉진3구역 재개발',
    sigungu: '부산진구',
    eventType: 'name_confirm',
    source: 'brand_registry:아크로',
    sourceUrl: 'https://www.acro.co.kr/',
    builderRaw: 'DL이앤씨',
    expectSiteId: '69c148ec-7a30-46b4-a7d6-3104c1e8053d',
    expectTier: 'T-A',
    expectApply: true,
    expectDisplay: '아크로 라로체 — 시민공원주변재정비촉진3구역 재개발',
    note: '공식 브랜드관 실증. 형제 촉진1·2-1·4 가 함께 있어도 3 으로 붙어야 한다.',
  },
  {
    key: 'acro-haeundae',
    proposedName: '아크로 해운대',
    projectName: '중동5 재개발',
    sigungu: '해운대구',
    eventType: 'name_confirm',
    source: 'brand_registry:아크로',
    sourceUrl: 'https://www.acro.co.kr/',
    builderRaw: 'DL이앤씨',
    expectSiteId: '68808c21-6c17-4107-a418-3343b77c3b5c',
    expectTier: 'T-A',
    expectApply: true,
    expectDisplay: '아크로 해운대 — 중동5 재개발',
    note: 'DB builder 가 «공란» 인 표적. 적용기가 시공사도 함께 채운다.',
  },
  {
    key: 'acro-onehide-cancel',
    proposedName: '아크로 원하이드',
    projectName: '우동1 재건축',
    sigungu: '해운대구',
    eventType: 'cancel',
    source: 'news:naver',
    sourceUrl: 'https://example.invalid/news/udong1-cancel',
    builderRaw: 'DL이앤씨',
    crossRefs: 1,
    expectSiteId: '5b03bbd1-774e-427d-a843-a7d808c99554',
    expectTier: 'T-역',
    expectApply: true,
    expectDisplay: '우동1 재건축',
    note: 'DL 해지 → 삭제가 아니라 강등. 별칭은 남고 표시만 구역명으로 돌아간다.',
  },
  {
    key: 'bifc-signature',
    proposedName: 'BIFC 시그니처',
    projectName: '문현3 재개발',
    sigungu: '남구',
    eventType: 'win',
    source: 'news:naver',
    sourceUrl: 'https://example.invalid/news/munhyeon3-win',
    builderRaw: '현대엔지니어링, 두산건설',
    crossRefs: 1,
    expectSiteId: '2b49c4d3-21e7-4ed3-a359-03b76518b5ee',
    expectTier: 'T-B',
    expectApply: true,
    expectDisplay: 'BIFC 시그니처 — 문현3 재개발',
    note: '문현1·6·7 이 함께 있어도 3 으로 붙어야 한다.',
  },
  {
    key: 'ifc-xi-the-sky',
    proposedName: 'IFC 자이 더 스카이',
    projectName: '문현1 재개발',
    sigungu: '남구',
    eventType: 'name_confirm',
    source: 'news:naver',
    sourceUrl: 'https://example.invalid/news/munhyeon1-name',
    builderRaw: 'GS건설',
    crossRefs: 1,
    expectSiteId: 'b286cae6-82cb-4074-9a27-f6853b86f5c7',
    expectTier: 'T-B',
    expectApply: true,
    expectDisplay: 'IFC 자이 더 스카이 — 문현1 재개발',
    note: '세대수는 설계서 3,813 · DB 2,568 로 갈렸다. 그래서 세대수를 기대값에 넣지 않는다.',
  },
  {
    key: 'dynasty-gaya',
    proposedName: '더 다이너스티 가야',
    projectName: '가야1 재개발',
    sigungu: '부산진구',
    eventType: 'win',
    source: 'news:naver',
    sourceUrl: 'https://example.invalid/news/gaya1-win',
    builderRaw: 'HDC현대산업개발, 대우건설',
    crossRefs: 1,
    expectSiteId: 'ef145c9d-11ee-4274-b9e1-c63f5a9bdd59',
    expectTier: 'T-B',
    expectApply: true,
    expectDisplay: '더 다이너스티 가야 — 가야1 재개발',
    note: '합성명 — 어느 브랜드관에도 없다. 뉴스가 유일 소스라는 것의 실례.',
  },
  {
    key: 'bid-proposal-blocked',
    proposedName: '가야 센트럴 파크뷰',
    projectName: '가야4 재개발',
    sigungu: '부산진구',
    eventType: 'bid',
    source: 'news:naver',
    sourceUrl: 'https://example.invalid/news/gaya4-bid',
    crossRefs: 2,
    expectSiteId: '533aca4a-4c6c-4088-9174-7e9b84ba67d4',
    expectTier: 'T-C',
    expectApply: false,
    note: '수주전 제안명. 교차 2건이어도 «적용하지 않는다» — 이긴 쪽이 정해지기 전이다.',
  },
];

/**
 * L2 셀프테스트용 기사 문면 픽스처.
 *
 * ⚠️ 실제 기사 원문이 아니라 «그 사건을 말하는 전형적 문면» 이다. URL 도 example.invalid 다.
 *    L2 가 검증하는 것은 「AI 가 이 문면에서 event_type 과 사업명을 옳게 읽는가」이지
 *    「오늘 그 기사가 살아 있는가」가 아니다 — 후자에 걸면 코드와 무관한 red 가 난다.
 * ⚠️ bid 문면은 «반드시» bid 로 읽혀야 한다. 이것이 T-C 차단의 입구다.
 */
export interface GoldenSnippet {
  key: string;
  title: string;
  description: string;
  url: string;
  expectEvent: 'bid' | 'win' | 'name_confirm' | 'rename' | 'cancel';
  expectProjectContains: string;
}

export const GOLDEN_SNIPPETS: GoldenSnippet[] = [
  {
    key: 'acro-laroche',
    title: 'DL이앤씨, 부산 시민공원주변재정비촉진3구역 단지명 「아크로 라로체」로 확정',
    description:
      'DL이앤씨는 부산진구 시민공원주변재정비촉진3구역 재개발 사업의 단지명을 아크로 라로체로 확정했다고 밝혔다. 총 3,545세대 규모다.',
    url: 'https://example.invalid/news/laroche-name',
    expectEvent: 'name_confirm',
    expectProjectContains: '촉진3',
  },
  {
    key: 'bifc-signature',
    title: '문현3 재개발 시공사에 현대엔지니어링·두산건설 컨소시엄 선정',
    description:
      '부산 남구 문현3 재개발 조합은 총회에서 현대엔지니어링·두산건설 컨소시엄을 시공사로 선정했다. 단지명은 BIFC 시그니처로 제안됐다.',
    url: 'https://example.invalid/news/munhyeon3-win',
    expectEvent: 'win',
    expectProjectContains: '문현3',
  },
  {
    key: 'ifc-xi-the-sky',
    title: '문현1 재개발 「IFC 자이 더 스카이」 단지명 확정',
    description:
      'GS건설이 시공하는 부산 남구 문현1 재개발 사업의 단지명이 IFC 자이 더 스카이로 확정됐다.',
    url: 'https://example.invalid/news/munhyeon1-name',
    expectEvent: 'name_confirm',
    expectProjectContains: '문현1',
  },
  {
    key: 'dynasty-gaya',
    title: '가야1 재개발 시공권 HDC현대산업개발·대우건설 컨소시엄에',
    description:
      '부산진구 가야1 재개발 조합이 HDC현대산업개발·대우건설 컨소시엄을 시공사로 선정했다. 단지명은 더 다이너스티 가야다. 1,943세대.',
    url: 'https://example.invalid/news/gaya1-win',
    expectEvent: 'win',
    expectProjectContains: '가야1',
  },
  {
    key: 'acro-onehide-cancel',
    title: '우동1 재건축 조합, DL이앤씨와 시공 계약 해지 의결',
    description:
      '부산 해운대구 우동1 재건축 조합이 임시총회에서 DL이앤씨와의 시공 계약 해지를 의결했다. 아크로 원하이드로 알려졌던 단지다.',
    url: 'https://example.invalid/news/udong1-cancel',
    expectEvent: 'cancel',
    expectProjectContains: '우동1',
  },
  {
    key: 'bid-proposal-blocked',
    title: '가야4 재개발 시공사 입찰에 2개사 참여… 제안 단지명 공개',
    description:
      '부산진구 가야4 재개발 시공사 선정 입찰에 2개 건설사가 참여했다. 한 곳은 가야 센트럴 파크뷰를 제안 단지명으로 내놨다. 선정 총회는 다음 달이다.',
    url: 'https://example.invalid/news/gaya4-bid',
    expectEvent: 'bid',
    expectProjectContains: '가야4',
  },
];
