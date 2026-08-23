// v5-V5 — 3단 이미지 체인 판정 + 조감도 우대.
//
// 체인:
//   1순위 hero_image_url       정식 수령 조감도 → 큐레이션 캐러셀 대형 노출
//   2순위 satellite_image_url  자체 호스팅 위성 → 목록 64×64 썸네일
//   3순위 없음                 → 단지명 이니셜 블록 (같은 64×64 점유)
//
// 허브 RPC 의 thumb_url 은 hero → satellite 순으로 이미 골라 내려준다.
// 어느 쪽이 뽑혔는지는 경로로 갈린다:
//   조감도 : /storage/v1/object/public/apt-covers/hero/{id}.webp   (어드민 업로드)
//   위성   : /storage/v1/object/public/images/satellite/{id}.webp  (apt-satellite-crawl)

export type ThumbKind = 'hero' | 'satellite' | 'none';

export function thumbKind(url?: string | null): ThumbKind {
  if (!url) return 'none';
  if (url.includes('/apt-covers/')) return 'hero';
  if (url.includes('/satellite/')) return 'satellite';
  // 알 수 없는 출처는 조감도로 승격하지 않는다 — 우대는 근거가 있을 때만 준다.
  return 'satellite';
}

export const isHeroThumb = (url?: string | null): boolean => thumbKind(url) === 'hero';

/**
 * 조감도 보유 현장을 앞으로 당긴다 — **동순위 안에서만**.
 *
 * ⚠️ 정렬을 뒤집지 말 것. 일정·상태 정렬(weight → dday)이 우선이다.
 *    조감도가 있다고 마감된 현장이 접수중보다 위로 오면 안 된다.
 *
 * 그래서 weight 가 같은 '연속 구간' 안에서만 안정 분할한다.
 * 구간 경계를 넘어 항목이 이동하지 않고, 조감도가 없는 항목들끼리의 상대 순서도
 * 그대로 유지된다 (RPC 가 정한 dday 순서가 보존된다).
 */
export function preferHero<T extends { weight?: number | null; thumb_url?: string | null }>(
  items: T[],
): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < items.length) {
    let j = i;
    const w = items[i].weight ?? null;
    while (j < items.length && (items[j].weight ?? null) === w) j++;
    const run = items.slice(i, j);
    // 안정 분할 — filter 두 번이면 각 그룹 내부 순서가 원본 그대로다.
    out.push(...run.filter((x) => isHeroThumb(x.thumb_url)));
    out.push(...run.filter((x) => !isHeroThumb(x.thumb_url)));
    i = j;
  }
  return out;
}

/**
 * 큐레이션(대형 노출) 후보. 조감도 우선, 없으면 위성으로 채운다.
 * 이미지가 아예 없는 현장은 넣지 않는다 — 큰 이미지 자리를 이니셜 블록으로 채우면
 * '있는 척' 이 된다 (목록 64px 칸과 판단 기준이 다르다).
 */
export function pickCuration<T extends { weight?: number | null; thumb_url?: string | null }>(
  items: T[],
  limit = 3,
): T[] {
  const withImage = preferHero(items).filter((x) => !!x.thumb_url);
  return withImage.slice(0, limit);
}
