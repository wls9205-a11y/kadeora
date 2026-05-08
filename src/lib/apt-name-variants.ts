/**
 * s261: 단지명 변형 자동 생성기
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

export function generateNameVariants(input: VariantInput): string[] {
  const variants = new Set<string>();
  const name = (input.name || '').trim();
  if (!name) return [];

  // 1) 원본
  variants.add(name);

  // 2) 공백 제거
  variants.add(name.replace(/\s+/g, ''));

  // 3) 시군구 + 단지명 조합
  if (input.sigungu) {
    const short = SIGUNGU_SHORT[input.sigungu] || input.sigungu.replace(/(시|군|구)$/, '');
    variants.add(`${short} ${name}`);
    variants.add(`${input.sigungu} ${name}`);
    variants.add(`${short}${name.replace(/\s+/g, '')}`);
  }

  // 4) 동 + 단지명 (자산동 데시앙)
  if (input.dong) {
    const dongClean = input.dong.replace(/동$/, '');
    // 단지명에 이미 동명이 포함됐으면 skip
    if (!name.includes(input.dong) && !name.includes(dongClean)) {
      variants.add(`${input.dong} ${name}`);
      variants.add(`${dongClean} ${name}`);
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
    if (input.sigungu) {
      const short = SIGUNGU_SHORT[input.sigungu] || input.sigungu.replace(/(시|군|구)$/, '');
      variants.add(`${short} ${brand}`);
    }
    if (input.dong) {
      const dongClean = input.dong.replace(/동$/, '');
      variants.add(`${dongClean} ${brand}`);
    }
  }

  // 7) 사용자 자연 검색어 — 시군구를 단지명 앞에 끼워넣기
  // "메트로시티 자산 데시앙" → "마산 자산 메트로시티 데시앙" 같은 케이스
  if (input.sigungu && tokens.length >= 2) {
    const short = SIGUNGU_SHORT[input.sigungu] || input.sigungu.replace(/(시|군|구)$/, '');
    // 두번째 토큰 앞에 시군구 끼워넣기 (마산 자산 메트로시티 데시앙)
    if (tokens.length >= 3) {
      const mixed = [tokens[0], short, ...tokens.slice(1)].join(' ');
      // 단, 첫 토큰이 이미 시군구가 아닐 때만
      if (!tokens[0].includes(short)) {
        variants.add(mixed);
      }
    }
  }

  // 빈 문자열·중복·너무 짧은 것 제거
  return Array.from(variants).filter(v => v && v.length >= 3);
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
