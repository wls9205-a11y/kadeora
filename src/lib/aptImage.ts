/**
 * apt_sites / apt_complex_profiles 이미지 픽킹 공용 헬퍼.
 *
 * 우선순위 (s203 강화):
 *   1) images[type ∈ {조감도, 모델하우스, 투시도}] — 단지 외관 강조 (rendering)
 *   2) images[type ∈ {단지배치도, 평면도}]         — 도면 (plan)
 *   3) images[0..] type 미분류 외부 이미지 (대부분 — Naver 뉴스 등)
 *   4) satellite_image_url                          — 위성사진 (식별 어려움, fallback)
 *   5) og_image_url                                 — 텍스트 카드 fallback
 *
 * 서버/클라이언트 어디서든 사용 가능한 순수 함수.
 */

type AnyImg = string | { url?: string; thumbnail?: string; thumb?: string; source?: string | null; type?: string | null } | null | undefined;

// ─── type 라벨 매핑 ───
const RENDERING_TYPES = ['조감도', '모델하우스', '투시도'] as const;
const PLAN_TYPES = ['단지배치도', '평면도'] as const;

const TYPE_LABEL: Record<string, string> = {
  '조감도': '🎨 조감도',
  '모델하우스': '🏠 모델하우스',
  '투시도': '🎨 투시도',
  '단지배치도': '📐 배치도',
  '평면도': '📐 평면도',
};

// ─── type 분류 첫 매칭 이미지 ───
function pickByType(images: unknown, types: readonly string[]): { url: string; type: string } | null {
  if (!Array.isArray(images)) return null;
  for (const im of images as AnyImg[]) {
    if (im && typeof im === 'object' && im.url && typeof im.url === 'string' && im.type && types.includes(im.type)) {
      // OG/api/og fallback 은 제외
      const src = (im.source || '').toLowerCase();
      if (src === 'og' || src === 'og_fallback' || src === 'og_generated') continue;
      if (im.url.includes('/api/og')) continue;
      return { url: im.url, type: im.type };
    }
  }
  return null;
}

export function pickRealImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const im of images as AnyImg[]) {
    if (!im) continue;
    const u = typeof im === 'string' ? im : (im.url || im.thumbnail || im.thumb);
    if (!u || typeof u !== 'string') continue;
    if (typeof im === 'object') {
      const src = (im.source || '').toLowerCase();
      if (src === 'og' || src === 'og_fallback' || src === 'og_generated') continue;
    }
    if (u.includes('/api/og')) continue;
    const picked = typeof im === 'string'
      ? u
      : (im.thumbnail || im.thumb || im.url || u);
    return picked || null;
  }
  return null;
}

export function pickBestAptImage(site: {
  images?: unknown;
  satellite_image_url?: string | null;
  og_image_url?: string | null;
}): string | null {
  // 1. rendering (조감도/모델/투시) 우선
  const rendering = pickByType(site.images, RENDERING_TYPES);
  if (rendering) return rendering.url;

  // 2. plan (배치도/평면도)
  const plan = pickByType(site.images, PLAN_TYPES);
  if (plan) return plan.url;

  // 3. type 미분류 외부 이미지 (대부분의 데이터)
  const real = pickRealImage(site.images);
  if (real) return real;

  // 4. satellite — 식별 어렵지만 최소 이미지 보장
  if (site.satellite_image_url && String(site.satellite_image_url).length > 10) {
    return site.satellite_image_url;
  }

  // 5. og — 텍스트 카드 fallback
  return site.og_image_url || null;
}

/** 픽된 이미지의 type 라벨 (UI caption chip 용). 매칭 X 면 null. */
export function pickImageCaption(images: unknown): string | null {
  const rendering = pickByType(images, RENDERING_TYPES);
  if (rendering) return TYPE_LABEL[rendering.type] || null;
  const plan = pickByType(images, PLAN_TYPES);
  if (plan) return TYPE_LABEL[plan.type] || null;
  return null;
}

/**
 * PostgREST `.in()` 은 내부적으로 URL 쿼리스트링을 사용해 긴 배열 시
 * URL 한계(≈16KB)를 초과함. chunk 로 쪼개서 배치 실행.
 */
export async function batchedInQuery<T>(
  runQuery: (chunk: string[]) => Promise<{ data: T[] | null }>,
  values: string[],
  chunkSize = 50,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    const slice = values.slice(i, i + chunkSize);
    const { data } = await runQuery(slice);
    if (data && data.length) out.push(...data);
  }
  return out;
}
