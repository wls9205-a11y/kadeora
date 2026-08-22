import { SITE_URL } from '@/lib/constants';

const SITE = SITE_URL.replace(/\/$/, '');

/**
 * s8/s9: blog_posts 의 cover_image 2,155편과 본문 이미지 3,566편이 외부 스크랩이다
 * (imgnews.naver.net 최다, 호스트 250종 이상).
 *
 * 화이트리스트로만 통과시킨다 — 블랙리스트로 뒤집으면 신규 호스트가 그대로 샌다.
 *
 * s9: S8 에서 이 판정을 generateMetadata 안의 지역 상수로 두는 바람에
 * openGraph·twitter 에만 적용되고 JSON-LD 세 곳이 그대로 남았다.
 * 두 벌이 생기면 한쪽만 고치게 되므로 공용 모듈 한 곳에서만 정의한다.
 */
export function isSafeImage(u?: string | null): boolean {
  return !!u && (u.includes('kadeora.supabase.co') || u.includes('/api/og'));
}

/**
 * 글의 대표 이미지. 커버가 안전하면 그대로, 아니면 생성 카드로 대체한다.
 * 노출 면적(1200x630)은 어느 쪽이든 확보된다.
 *
 * 반환 URL 은 S8 의 heroOg 와 바이트 단위로 같아야 한다 — 다르면 이미 캐시된
 * OG 이미지가 전부 새로 생성된다. (category·author_name 은 발행 글에서 non-null 이라
 * `|| 기본값` 이 실제 출력에 영향을 주지 않는 것을 실측 확인했다.)
 */
export function blogHeroImage(post: {
  cover_image?: string | null;
  title: string;
  category?: string | null;
  author_name?: string | null;
}): string {
  return isSafeImage(post.cover_image)
    ? post.cover_image!
    : `${SITE}/api/og?title=${encodeURIComponent(post.title)}` +
      `&category=${post.category || 'general'}` +
      `&author=${encodeURIComponent(post.author_name || '카더라')}&design=2`;
}
