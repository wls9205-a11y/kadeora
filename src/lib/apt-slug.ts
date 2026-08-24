// 아파트 현장명 → URL slug.
//
// ⚠️ 이 파일이 **유일한 원본**이다. 다른 곳에 slug 생성을 다시 만들지 말 것.
//    중복 256쌍(V15 A-1)이 규칙이 두 벌이던 결과다.
//
// ── 규칙 ──
//   1. 앞뒤 공백 제거
//   2. 공백(연속 포함) → 하이픈 하나
//   3. 한글·영숫자·밑줄·하이픈 외 전부 제거
//   4. 영문은 **소문자로 보존한다** — 지우지 않는다.
//      영문 토막을 지우던 규칙이 `DMC SK VIEW 아이파크포레` → `---아이파크포레` 를 만들었다.
//      그 규칙은 이미 코드에 없다 (실측: 깨진 slug 최신 생성 2026-03-24, 최신 행 2026-08-23).
//
// ⚠️ **기존 slug 를 바꾸지 말 것.** 색인이 걸려 있고 `apt_site_merges` 301 맵도
//    기존 값 기준이다. 활성 160행이 아직 깨진 형태(`^-` · `--` · `-$`)를 쓴다.

/**
 * 느슨한 규칙 — **기존 데이터와 호환되는 형태**.
 *
 * 조회·링크 폴백에서 쓴다. `sync-apt-sites` 는 이 값으로 기존 행을 **조회도** 하므로
 * 여기 규칙을 바꾸면 매칭이 어긋나 같은 현장이 매 실행마다 새로 생긴다.
 *
 * ⚠️ 이 규칙은 하이픈 주변 공백에서 연속 하이픈을 만든다:
 *      `e편한세상 - 가평` → `e편한세상---가평`
 *    알고도 그대로 두는 이유는 위와 같다. 새 레코드에는 아래 strict 를 쓴다.
 */
export function generateAptSlug(name: string): string {
  if (!name || !name.trim()) return '';
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣\-]/g, '')
    .toLowerCase();
}

/**
 * 엄격한 규칙 — **새로 만드는 레코드에만** 쓴다.
 *
 * 느슨한 규칙에 두 가지를 더한다.
 *   - 연속 하이픈을 하나로
 *   - 앞뒤 하이픈 제거
 *
 * ⚠️ 기존 행을 조회하는 경로에 쓰지 말 것. 느슨한 값으로 저장된 행을 못 찾는다.
 *    쓰는 곳은 "이 이름으로 저장된 행이 없음을 이미 확인한" 생성 경로뿐이다
 *    (어드민 한 줄 입력 등).
 */
export function generateAptSlugStrict(name: string): string {
  const loose = generateAptSlug(name);
  if (!loose) return '';
  return loose.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

/** 느슨한 규칙이 만들어 낸 값이 깨진 형태인가. 로그·점검용. */
export function isDegradedSlug(slug: string): boolean {
  return /^-|--|-$/.test(slug);
}

// slug인지 숫자 ID인지 판별
export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

// s218 Track A: UUID 형식 판별 (apt_sites.id 직접 lookup 분기용)
// Supabase apt_sites 의 id 가 uuid 형. /apt/<uuid> 직접 진입 시 slug 로 잘못 lookup → 404 발생.
export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
