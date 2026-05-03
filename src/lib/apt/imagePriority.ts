/**
 * s205-W3: apt 카드 이미지 정렬 우선순위.
 *
 * apt_sites 5,823건 중 자체 이미지 100% 가 satellite/ 폴더 (3,095장) 였던 문제 해결용.
 * 카드 썸네일 노출 시 satellite 는 다른 이미지가 0개일 때만 노출되도록 강등 (priority=90).
 *
 * 서버 측 동등 함수: get_image_priority RPC + get_apt_site_images_sorted RPC.
 * (DB와 동일한 로직을 TS 측에서도 유지해 hydration 시점에도 동일 정렬.)
 */

export function getImagePriority(url: string): number {
  if (!url) return 999;
  if (/lottecastle|xi\.co\.kr|hillstate|i-park\.|prugio|hyundai-eng|daewoo-enc|sk-ecoplant/.test(url)) return 5;
  if (/kadeora\.supabase\.co\/storage/.test(url) && !/\/satellite\//.test(url)) return 10;
  if (/landthumb-phinf|ldb-phinf/.test(url)) return 30;
  if (/phinf\.pstatic\.net|cloudfront/.test(url)) return 40;
  if (/imgnews\.naver\.net|blog\.kakaocdn|t1\.daumcdn/.test(url)) return 70;
  if (/\/api\/og/.test(url)) return 80;
  if (/\/satellite\//.test(url)) return 90;
  return 50;
}

export const sortByImagePriority = (urls: string[] = []): string[] =>
  [...urls].sort((a, b) => getImagePriority(a) - getImagePriority(b));

/** images jsonb / array 에서 priority 가 가장 높은 (=숫자가 낮은) URL 1장 추출. */
export function pickPrimaryImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const urls: string[] = [];
  for (const it of images) {
    if (typeof it === 'string' && it.length > 0) urls.push(it);
    else if (it && typeof it === 'object') {
      const u = (it as any).url || (it as any).thumbnail || (it as any).image_url;
      if (typeof u === 'string' && u.length > 0) urls.push(u);
    }
  }
  if (urls.length === 0) return null;
  const sorted = sortByImagePriority(urls);
  return sorted[0] || null;
}
