// H3-3 — 칩에 넣을 현장명 축약.
//
// ── 왜 brand.ts 의 제목 추출을 안 쓰는가 ──
// 지시서가 "src/lib/og/brand.ts 의 제목 추출을 재사용할 수 있는지 먼저 확인할 것" 이라 해서
// 실제로 돌려 봤다. 목적이 다르다.
//
//   titleLines('센트레빌 아스테리움 거제')  →  ['센트레빌', '아스테리움', '거제']
//
// titleLines 는 «썸네일 2~3줄 분할» 이다. 한 줄로 줄이는 함수가 아니고,
// DROP 목록으로 '분석' '현황' 같은 편집 접미사를 떼며 지역 접두어까지 지운다.
// 칩에서 지역은 오히려 있어야 하는 정보다.
// 그걸 칩에 끌어다 쓰면 썸네일 규칙을 고칠 때 칩이 같이 바뀐다 — 결합이 잘못됐다.
//
// 그래서 한 가지만 하는 작은 함수를 따로 둔다.

/** 칩에 들어갈 최대 글자수. 이보다 길면 가운데를 버린다. */
const MAX = 12;

/**
 * 긴 현장명을 칩 크기로 줄인다.
 *
 *   '센트레빌 아스테리움 거제'            → '센트레빌 거제'
 *   '울산 다운2지구 우미린 더 시그니처 본청약' → '울산 본청약'  (아래 주의 참조)
 *   '해링턴 마레'                       → '해링턴 마레'  (그대로)
 *
 * 규칙: 12자 이하면 그대로. 넘으면 «첫 어절 + 마지막 어절» 로 줄인다 —
 * 브랜드와 지역이 양 끝에 오는 한국 단지명 관례를 따른 것이다.
 * 그래도 넘으면 첫 어절만 남긴다. 말줄임표는 쓰지 않는다(칩에서 '...' 는 눌러야 할지 알 수 없다).
 *
 * ⚠️ 어절이 둘뿐인데 길면 자를 곳이 없다. 그때는 원문을 그대로 돌려준다 —
 *    의미를 깨느니 칩 하나가 넓은 편이 낫다.
 */
export function shortSiteName(raw: string, max = MAX): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  if (name.length <= max) return name;

  const w = name.split(' ').filter(Boolean);
  if (w.length >= 3) {
    const pair = `${w[0]} ${w[w.length - 1]}`;
    if (pair.length <= max) return pair;
    if (w[0].length <= max) return w[0];
    return pair;                       // 첫 어절조차 길면 둘을 남긴다 — 정보가 더 많다
  }
  if (w.length === 2 && w[0].length <= max) return w[0];
  return name;                         // 자를 자리가 없다
}
