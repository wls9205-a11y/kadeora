/**
 * 포인트 규칙 단일 진실 공급원 (SSOT)
 * 
 * 모든 포인트 표시 UI(가이드, 등급, 상점 등)는 이 파일에서 import
 * 실제 award_points RPC 호출과 동기화됨
 */

export interface PointRule {
  amount: number;
  label: string;
  description?: string;
  once?: boolean;      // 1회성 여부
  implemented: boolean; // 실제 구현 여부
}

export const POINT_RULES: Record<string, PointRule> = {
  welcome:     { amount: 100, label: '가입 보너스',      implemented: true, once: true },
  post:        { amount: 10, label: '게시글 작성',      implemented: true },
  comment:     { amount: 5,  label: '댓글 작성',        implemented: true, description: '블로그/주식/아파트/토론 댓글 포함' },
  attendance:  { amount: 10, label: '출석체크',          implemented: true },
  share:       { amount: 5,  label: '공유',             implemented: true },
  avatar:      { amount: 30, label: '프로필 사진 등록',  implemented: true, once: true },
  review:      { amount: 10, label: '아파트 리뷰 작성',  implemented: true },
  interest:    { amount: 50, label: '관심단지 등록',     implemented: true },
  chat:        { amount: 1,  label: '채팅 참여',         implemented: true },
  prediction:  { amount: 10, label: '코스피 예측 참여',  implemented: true },
} as const;

export const ATTENDANCE_BONUS = {
  streak7:  { amount: 30,  label: '7일 연속 보너스' },
  streak30: { amount: 100, label: '30일 연속 보너스' },
} as const;

/** UI 표시용 — implemented 필터링된 규칙만 반환 */
export function getDisplayRules() {
  return Object.values(POINT_RULES)
    .filter(r => r.implemented)
    .map(r => ({ action: r.label, pts: `+${r.amount}P`, note: r.description || (r.once ? '최초 1회' : '') }));
}
