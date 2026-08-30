// B8-1 — 현장 상세 안의 «점프 목적지» id 한 벌.
//
// 왜 lib 인가: 목적지를 가진 쪽(AptCommentSection)과 보내는 쪽(SiteFloatingActions)이
// 서로를 import 하면 dynamic() 으로 잘라 둔 댓글 청크가 다시 붙는다.
// 문자열만 여기 두고 양쪽이 각자 읽는다.
//
// ⚠️ LEAD_FORM_ID 를 «여기로 옮겼다» (2026-08-30 · P0-A).
//    예전 주석은 「LeadForm 이 자기 id 를 export 하는 기존 배선이 이미 있고 폼은
//    dynamic 이 아니다」는 이유로 안 옮겼는데, 그 판단이 놓친 것이
//    «서버 / 클라이언트 경계» 다.
//
//    LeadForm.tsx 는 'use client' 다. 서버 컴포넌트인 /apt/[id]/page.tsx 가
//    거기서 export 된 상수를 읽으면 «문자열이 아니라 클라이언트 참조 프록시» 를 받는다.
//    그 값이 그대로 점프바 CTA 의 href 에 들어갔고, 배포본 실측에서 이렇게 나왔다:
//
//      href="#function(){throw Error(\"Attempted to call LEAD_FORM_ID() from the
//             server but LEAD_FORM_ID is on the client…\")}"
//
//    즉 그 버튼은 «어디도 가리키지 않는 앵커» 였다 — 눌러도 완전 무반응이다.
//
//    ⚠️ 하단 액션바는 «클라이언트» 라 «같은 import 가 정상 동작했다».
//       그래서 한쪽만 깨졌고, 코드만 읽어서는 두 곳이 같은 값을 쓰는 것처럼 보인다.
//       이 결함은 «렌더된 href 를 봐야» 보인다.
//
//    ⛔ 클라이언트 모듈에서 «상수» 를 export 해 서버가 읽게 두지 않는다.
//       컴포넌트는 클라이언트에 두더라도 그 컴포넌트가 쓰는 «값» 은 lib 에 둔다.

/** 리드폼 컨테이너. 점프바 CTA·레일 링크의 앵커이자 액션바 scrollIntoView 목적지. */
export const LEAD_FORM_ID = 'lead-form';

/** 댓글 섹션 컨테이너. scrollIntoView 목적지. */
export const APT_COMMENT_SECTION_ID = 'comment-section';

/** 댓글 입력창. 스크롤이 끝난 뒤 focus() 대상. */
export const APT_COMMENT_INPUT_ID = 'kd-apt-comment-input';
