// blog_posts.og_cards 빌더 — slug + title 로부터 6-card jsonb 배열을 결정적으로 생성.
// 기존 6,926 건의 백필 구조와 100% 동일하게 유지(호환). 발행 시 아무 코드도 이걸 안 만들어
// 26%(2,463)가 빈 배열로 남던 문제의 단일 소스.
export interface OgCard {
  idx: number;
  type: string;
  url: string;
  alt: string;
}

// idx → { type, alt 접미사 } — 기존 데이터와 동일.
const CARD_SPEC: { idx: number; type: string; suffix: string }[] = [
  { idx: 1, type: 'cover', suffix: '' },
  { idx: 2, type: 'metric', suffix: ' 핵심 데이터' },
  { idx: 3, type: 'detail', suffix: ' 분석' },
  { idx: 4, type: 'timing', suffix: ' 일정' },
  { idx: 5, type: 'compare', suffix: ' 비교' },
  { idx: 6, type: 'cta', suffix: ' 단지 자세히 보기' },
];

export function buildBlogOgCards(slug: string, title: string | null | undefined): OgCard[] {
  const t = (typeof title === 'string' && title) ? title : (slug || '카더라 콘텐츠');
  // url 에 slug 는 raw 로 넣는다(기존 데이터와 동일). 실제 fetch 시 브라우저가 인코딩.
  return CARD_SPEC.map((c) => ({
    idx: c.idx,
    type: c.type,
    url: `/api/og-blog?slug=${slug}&card=${c.idx}&v=1`,
    alt: t + c.suffix,
  }));
}
