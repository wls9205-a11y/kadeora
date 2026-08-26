// ⚠️ 이 여덟 값은 «흰 글씨의 배경» 으로만 쓰인다(아바타 원 안 이니셜, 8곳).
//    원래 파스텔이라 흰 글씨 대비가 1.43~2.72 였다 — 이니셜이 사실상 안 보였다.
//    TY1-4 에서 색상(H)·채도(S)는 그대로 두고 명도(L)만 낮춰 전부 4.8 이상으로 올렸다.
//    ⛔ 다시 밝히지 말 것. 호출부 8곳이 전부 color:'#fff' 를 하드코딩하고 있어
//       여기서 어두운 값을 보장하지 않으면 전 화면이 같이 무너진다.
//       (blog/[slug] · discuss/ChatRoom · feed/FeedClient · feed/[id] ·
//        AptCommentInline · AptReviewSection · CommentSection · StockComments)
export const AVATAR_COLORS = ['#006EE1','#8D6E00','#0E8157','#8447FF','#E50030','#0B7C8D','#B35800','#1A7F72'];
export function getAvatarColor(str: string): string {
  const hash = (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
