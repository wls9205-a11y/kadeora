/**
 * s261: 단지명 변형 자동 생성기
 *
 * ⛔ 이 파일은 «호출자가 없다». 실제 생산자는 DB 트리거다 (CV-B ① 실측) —
 *      apt_sites INSERT/UPDATE(name·sigungu·dong·builder)
 *        → trg_apt_sites_auto_variants → apt_sites_auto_variants()
 *        → generate_apt_name_variants_jsonb()
 *    규칙을 고칠 때는 «그 함수를 먼저» 고친다. 여기만 고치면 아무것도 바뀌지 않는다.
 *    정본: supabase/migrations/cvb1_name_variants_fragment_2026-09-02.sql
 *    (이 파일은 같은 규칙의 TS 사본이고, 단위 테스트가 규칙을 지킨다.)
 *
 * 사용자 자연 검색어 매칭을 위해 단지명에서 다양한 변형을 생성한다.
 * 마산 자산 데시앙 케이스: "메트로시티 자산 데시앙" 공식 명칭이지만
 * 사용자는 "마산 자산 메트로시티 데시앙", "마산 자산 데시앙", "자산동 데시앙" 등
 * 다양한 형태로 검색하므로 각 변형을 name_variants에 채워야 검색매칭됨.
 *
 * 입력: name, sigungu, dong, address, builder/brand_name
 * 출력: 6+ 변형 문자열 배열
 */

interface VariantInput {
  name: string;
  sigungu?: string | null;
  dong?: string | null;
  address?: string | null;
  builder?: string | null;
  brand_name?: string | null;
}

// 시군구에서 인지도 높은 줄임말 추출 (마산합포구 → 마산, 해운대구 → 해운대)
const SIGUNGU_SHORT: Record<string, string> = {
  '마산합포구': '마산', '마산회원구': '마산', '진해구': '진해',
  '의창구': '의창', '성산구': '성산',
  '해운대구': '해운대', '수영구': '수영', '연제구': '연제',
  '부산진구': '서면', '강서구': '강서', '강동구': '강동',
  '일산동구': '일산', '일산서구': '일산',
  '분당구': '분당', '수정구': '수정', '중원구': '중원',
};

// 브랜드명 매핑 (시공사명에서 브랜드 추출)
const BUILDER_TO_BRAND: Record<string, string> = {
  '삼성물산': '래미안', 'GS건설': '자이', '현대건설': '힐스테이트',
  '대우건설': '푸르지오', 'DL이앤씨': '아크로', 'SK에코플랜트': 'SK뷰',
  '포스코이앤씨': '더샵', '롯데건설': '롯데캐슬', '한화건설': '포레나',
  '호반건설': '호반써밋', 'HDC현대산업개발': '아이파크', '두산건설': '두산위브',
  '대림산업': 'e편한세상', '태영건설': '데시앙', '제일건설': '제일풍경채',
  '한양': '수자인', '코오롱글로벌': '하늘채', '금호건설': '어울림',
  '동원개발': '비스타', '부영주택': '부영',
};

/**
 * 동명에서 「동」을 뗀 짧은 형태. ⚠️ 떼고 나서 «두 글자 미만» 이면 주지 않는다.
 * `외동`·`내동`·`하동` 처럼 두 글자짜리 동이 실제로 많고, 거기서 「외」·「내」를 뽑으면
 * 어느 현장도 가리키지 못하는 조각이 된다 (CV-A 「외 데시앙」).
 */
function shortDong(dong: string): string | null {
  const c = dong.replace(/동$/, '');
  return c.length >= 2 ? c : null;
}

/**
 * 시군구의 «짧은 형태». 목록에 없으면 접미어(시·군·구)를 떼되,
 * ⚠️ 떼고 나서 한 글자면 «떼지 않는다». 실측: `중구`→「중」이 그대로 별칭이 되어
 * 「대전 중 유천1구역 지역주택조합」류가 134건 쌓였다(동 43 · 남 42 · 북 37 · 서 36 …).
 * 한 글자 구 이름은 붙여도 현장을 좁히지 못하고, 사람은 「중구」로 검색한다.
 */
function shortSigungu(sigungu: string): string {
  const mapped = SIGUNGU_SHORT[sigungu];
  if (mapped) return mapped;
  const c = sigungu.replace(/(시|군|구)$/, '');
  return c.length >= 2 ? c : sigungu;
}

/**
 * 우리가 «잘라서 만들어 낸» 한 글자 조각이 든 변형인가.
 *
 * ⚠️ 「한 글자 토큰이면 무조건 조각」으로 걸면 안 된다. 실측 685건 중 「더」 189
 *    (『DS 더 웰가』·『가평 센트럴파크 더 스카이』) · 「린」 27 (『우미 린』) ·
 *    「후」 33 · 「뜰」(『에일린의 뜰』) 은 «이름에 원래 있는» 글자라 살려야 한다.
 * ⚠️ 「대표명의 «토큰»이냐」로 걸어도 안 된다. 대표명이 붙여쓰기인 현장이 많아
 *    (『가평센트럴파크더스카이』) 띄어쓴 정상 변형이 통째로 죽는다. 그래서 기준은
 *    «공백 지운 대표명이 그 글자를 품고 있느냐» 다.
 * ⚠️ 대표명의 토큰을 «포함하면» 조각이라는 식의 구조 규칙은 금지다 — `sa.py` 가
 *    그걸 뒀다가 「창원자이」·「경남아너스빌」을 죽여서 되돌렸다(`alias_is_fragment` 주석).
 *    여기 판정은 «한 글자 토큰» 에만 걸린다.
 */
function hasFragmentToken(v: string, name: string): boolean {
  const bare = name.replace(/\s+/g, '');
  return v.split(/\s+/).some(t => t.length === 1 && /[가-힣]/.test(t) && !bare.includes(t));
}

export function generateNameVariants(input: VariantInput): string[] {
  const variants = new Set<string>();
  const name = (input.name || '').trim();
  if (!name) return [];

  // 1) 원본
  variants.add(name);

  // 2) 공백 제거
  variants.add(name.replace(/\s+/g, ''));

  // 3) 시군구 + 단지명 조합
  // ⚠️ 단지명이 이미 시군구를 달고 있으면 붙이지 않는다. CV-A 실측: 『김해 외동 재건축사업』이
  //    「김해김해외동재건축사업」을 낳았다 — 아무도 그렇게 검색하지 않는 죽은 키워드다.
  //    규칙 4 에는 이 가드(`name.includes`)가 있었고 규칙 3 에만 없었다.
  if (input.sigungu) {
    const short = shortSigungu(input.sigungu);
    if (!name.includes(short) && !name.includes(input.sigungu)) {
      variants.add(`${short} ${name}`);
      variants.add(`${input.sigungu} ${name}`);
      variants.add(`${short}${name.replace(/\s+/g, '')}`);
    }
  }

  // 4) 동 + 단지명 (자산동 데시앙)
  if (input.dong) {
    const dongClean = shortDong(input.dong);
    // 단지명에 이미 동명이 포함됐으면 skip
    if (!name.includes(input.dong) && !(dongClean && name.includes(dongClean))) {
      variants.add(`${input.dong} ${name}`);
      if (dongClean) variants.add(`${dongClean} ${name}`);
    }
  }

  // 5) 토큰 순서 변형 — "메트로시티 자산 데시앙" → "자산 메트로시티 데시앙", "데시앙 자산 메트로시티"
  const tokens = name.split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length >= 3) {
    // 모든 토큰 순열은 너무 많아서 흔한 2가지만:
    // (a) 첫 토큰을 마지막으로
    variants.add([...tokens.slice(1), tokens[0]].join(' '));
    // (b) 첫 토큰과 두 번째 토큰 swap
    variants.add([tokens[1], tokens[0], ...tokens.slice(2)].join(' '));
  }

  // 6) 브랜드 + 단지명 (브랜드 단독 검색 케이스)
  let brand = input.brand_name;
  if (!brand && input.builder) {
    brand = BUILDER_TO_BRAND[input.builder] || null;
  }
  if (brand && !name.includes(brand)) {
    const short = input.sigungu ? shortSigungu(input.sigungu) : null;
    if (short) variants.add(`${short} ${brand}`);
    if (input.dong) {
      // ⚠️ 동명을 «자르지 않은» 형태가 먼저다. CV-A 실측: `dong='외동'` 에서 `동`을 떼면
      //    「외」 한 글자가 남아 「외 데시앙」이 나갔다. sa.py `name_pool()` 은 별칭을
      //    «짧은 순» 으로 채택하므로 이런 조각이 그 현장의 1순위 키워드가 된다.
      variants.add(`${input.dong} ${brand}`);
      if (short) variants.add(`${short} ${input.dong} ${brand}`);
      const dongClean = shortDong(input.dong);
      if (dongClean) variants.add(`${dongClean} ${brand}`);
    }
  }

  // 7) 사용자 자연 검색어 — 시군구를 단지명 앞에 끼워넣기
  // "메트로시티 자산 데시앙" → "마산 자산 메트로시티 데시앙" 같은 케이스
  if (input.sigungu && tokens.length >= 2) {
    const short = shortSigungu(input.sigungu);
    // 두번째 토큰 앞에 시군구 끼워넣기 (마산 자산 메트로시티 데시앙)
    if (tokens.length >= 3) {
      const mixed = [tokens[0], short, ...tokens.slice(1)].join(' ');
      // 단, 첫 토큰이 이미 시군구가 아닐 때만
      if (!tokens[0].includes(short) && !name.includes(short)) {
        variants.add(mixed);
      }
    }
  }

  // 빈 문자열·중복·너무 짧은 것·조각 제거
  return Array.from(variants).filter(v => v && v.length >= 3 && !hasFragmentToken(v, name));
}

/**
 * apt_sites 한 row를 받아 name_variants를 채우는 헬퍼
 */
export function buildVariantsFromAptSite(site: {
  name: string;
  sigungu?: string | null;
  dong?: string | null;
  address?: string | null;
  builder?: string | null;
}): string[] {
  return generateNameVariants(site);
}
