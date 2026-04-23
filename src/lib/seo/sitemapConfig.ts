/**
 * 공유 sitemap 페이지 크기 상수.
 * image-sitemap.xml (index) 와 sitemap-image/[page] (child) 가 반드시 동일 값을 사용해야 함.
 * 1K/page — URL 당 평균 5~10 <image:image> 태그, 페이지당 약 2MB 이내 (Vercel ISR 19MB 한도 안전 여유).
 */
export const URLS_PER_PAGE = 1000;
