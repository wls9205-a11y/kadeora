// B8-1 — 현장 상세 안의 «점프 목적지» id 한 벌.
//
// 왜 lib 인가: 목적지를 가진 쪽(AptCommentSection)과 보내는 쪽(SiteFloatingActions)이
// 서로를 import 하면 dynamic() 으로 잘라 둔 댓글 청크가 다시 붙는다.
// 문자열 두 개만 여기 두고 양쪽이 각자 읽는다.
//
// ⚠️ LEAD_FORM_ID 는 여기로 옮기지 않았다. 그쪽은 LeadForm 이 자기 id 를 export 하는
//    기존 배선(SiteActionBar → LeadForm)이 이미 있고, 폼은 dynamic 이 아니다.

/** 댓글 섹션 컨테이너. scrollIntoView 목적지. */
export const APT_COMMENT_SECTION_ID = 'comment-section';

/** 댓글 입력창. 스크롤이 끝난 뒤 focus() 대상. */
export const APT_COMMENT_INPUT_ID = 'kd-apt-comment-input';
