/**
 * 외부 API 로 «JSON 본문에 실어 보낼» 문자열을 안전하게 만드는 유틸.
 *
 * 배경 (2026-08-25) —
 *   blog-meta-rewrite-submit 이 30일 성공 0 이었고, Batch API 가
 *   `400 "The request body is not valid JSON: no low surrogate in string"` 을 냈다.
 *
 *   원인은 원본 데이터가 아니라 «자르기» 였다.
 *   `String.prototype.slice` 는 UTF-16 «코드유닛» 단위로 자른다. 이모지처럼
 *   서로게이트 쌍(2 코드유닛)으로 표현되는 글자가 경계에 걸리면 쌍이 쪼개져
 *   짝 잃은 서로게이트가 남는다. 그 상태로 JSON.stringify 하면 `\ud83d` 같은
 *   «짝 없는 이스케이프» 가 본문에 들어가고, 엄격한 파서는 이를 거절한다.
 *
 *   실측 — 큐 500건 중 깨진 건 단 1건(apt-ann-2026000078 의 content)이었다.
 *   배치는 전부 아니면 전무라 그 1건이 나머지 499건을 같이 죽였다.
 *
 * ⚠️ `sanitizeForOG` 를 쓰면 안 된다. 그쪽은 NotoSansKR 폰트가 그릴 수 있는
 *    글자만 남기는 «화이트리스트» 라, CJK·이모지는 물론 문장부호까지 지운다.
 *    OG 이미지에는 맞지만 LLM 입력에 쓰면 본문이 파괴된다. 문제의 계열은 같아도
 *    해법이 다르다 — 여기서는 «형태만» 고치고 내용은 건드리지 않는다.
 */

const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

/** 짝을 잃은 서로게이트(상·하 모두)를 찾는다. */
export const LONE_SURROGATE_RE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * 서로게이트 쌍을 쪼개지 않고 자른다.
 *
 * 길이 의미는 기존 `.slice(0, n)` 그대로 UTF-16 코드유닛이다 — 호출부의 상한
 * 감각(제목 80, 발췌 220, 본문 400)을 바꾸지 않으려는 의도다. 다만 마지막 글자가
 * 상위 서로게이트로 끝나면 «그 한 글자를 통째로 버린다». 반쪽을 남기느니 빼는 게 낫다.
 */
export function safeSlice(input: string | null | undefined, max: number): string {
  const s = String(input ?? '');
  if (s.length <= max) return s;
  const out = s.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= HIGH_SURROGATE_START && last <= HIGH_SURROGATE_END) {
    return out.slice(0, -1);
  }
  return out;
}

/**
 * 문자열 어디에 있든 짝 잃은 서로게이트를 제거한다.
 *
 * safeSlice 가 «자르다 생기는» 깨짐을 막는다면 이건 «원본에 이미 들어 있는» 깨짐을
 * 막는다. DB 에 정상 UTF-8 로 들어왔더라도 중간 처리에서 깨질 수 있으니 마지막
 * 방어선으로 둔다. 지우기만 하고 U+FFFD 로 바꾸지 않는다 — LLM 입력에 대체문자를
 * 섞으면 그것대로 노이즈다.
 */
export function stripLoneSurrogates(input: string | null | undefined): string {
  const s = String(input ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= HIGH_SURROGATE_START && c <= HIGH_SURROGATE_END) {
      const next = s.charCodeAt(i + 1);
      if (next >= LOW_SURROGATE_START && next <= LOW_SURROGATE_END) {
        out += s[i] + s[i + 1];
        i++;
      }
      // 짝이 없으면 버린다
      continue;
    }
    if (c >= LOW_SURROGATE_START && c <= LOW_SURROGATE_END) continue; // 앞짝 없는 하위
    out += s[i];
  }
  return out;
}

/** 자르고 + 남은 깨짐까지 제거. 외부 API 페이로드에 넣기 전 기본 경로. */
export function jsonSafeSlice(input: string | null | undefined, max: number): string {
  return stripLoneSurrogates(safeSlice(input, max));
}

/**
 * 페이로드 안에서 깨진 문자열을 가진 항목을 찾아낸다.
 * 실패 로그에 «어느 글이 원인인지» 남기기 위한 것 — 지금까지 알 방법이 없었다.
 */
export function findLoneSurrogateItems<T>(
  items: T[],
  getTexts: (item: T) => Array<[field: string, text: string]>,
  label: (item: T) => string,
): string[] {
  const bad: string[] = [];
  for (const it of items) {
    for (const [field, text] of getTexts(it)) {
      if (LONE_SURROGATE_RE.test(text)) bad.push(`${label(it)}[${field}]`);
    }
  }
  return bad;
}
