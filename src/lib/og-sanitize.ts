// s248: og 라우트 input string sanitize
// satori (next/og)는 NotoSansKR-Bold.woff에서 처리 못 하는 글자 발견 시
// 외부 dynamic font fetch 시도 → Vercel network block → "Failed to load dynamic font" throw
// 영향 데이터: apt_sites.name 3건 (그대家 등), blog_posts.title 5건

const HANJA_TO_HANGUL: Record<string, string> = {
  '家': '가', '安': '안', '愛': '애',
  '新': '신', '東': '동', '西': '서', '南': '남', '北': '북',
  '大': '대', '小': '소', '中': '중', '上': '상', '下': '하',
  '山': '산', '海': '해', '川': '천', '林': '림', '田': '전',
  '春': '춘', '夏': '하', '秋': '추', '冬': '동',
  '月': '월', '日': '일', '年': '년', '時': '시',
  '高': '고', '長': '장', '正': '정', '元': '원',
  '光': '광', '明': '명', '天': '천', '地': '지', '人': '인',
  '金': '금', '銀': '은', '玉': '옥', '石': '석',
  '美': '미', '王': '왕', '宮': '궁', '城': '성',
  '永': '영', '樂': '락', '青': '청', '白': '백', '黒': '흑',
  '一': '일', '二': '이', '三': '삼', '四': '사', '五': '오',
};

export function sanitizeForOG(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[一-鿿]/g, (ch) => HANJA_TO_HANGUL[ch] ?? '')
    .replace(/[぀-ヿ]/g, '')
    .replace(/[豈-﫿⼀-⿟㐀-䶿]/g, '')
    .replace(/[─-▟■-◿✀-➿]/g, '')
    // s250: 전각 → 반각 변환 (８１５→815, （）→(), ，→,, ：→:)
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    // s250: 전각 공백 (U+3000) → 일반 공백
    .replace(/　/g, ' ')
    // s250: CJK Symbols and Punctuation 나머지 제거 (전각 공백 제외)
    .replace(/[、-〿]/g, '')
    // s250: General Punctuation zero-width / 특수 공백 제거
    .replace(/[\u200B-\u200F\u2028-\u202F\u205F-\u206F]/g, '')
    // s250: General Punctuation dash/hyphen → ASCII -
    .replace(/[‐-―]/g, '-')
    // s250: General Punctuation 따옴표 → ASCII "
    .replace(/[‘-‟]/g, '"')
    // s259: NotoSansKR-Bold.woff에서 처리 가능한 글자만 keep (strict whitelist)
    // 한글 음절(가-힣) + 한글 자모(ㄱ-ㅣ) + ASCII printable + 일부 안전 기호
    .replace(/[^ -~가-힯ᄀ-ᇿ㄰-㆏·]/g, '')
    .trim();
}

// 객체의 모든 string field에 sanitize 자동 적용
// s256: array element도 sanitize (postgres text[]/jsonb array 컬럼 처리)
export function sanitizeRowForOG<T extends Record<string, any>>(row: T | null | undefined): T | null {
  if (!row) return null;
  const result: any = { ...row };
  for (const key in result) {
    const v = result[key];
    if (typeof v === 'string') {
      result[key] = sanitizeForOG(v);
    } else if (Array.isArray(v)) {
      result[key] = v.map((item) =>
        typeof item === 'string' ? sanitizeForOG(item) : item
      );
    }
  }
  return result as T;
}
