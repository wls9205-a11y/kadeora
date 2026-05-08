// s262 Phase B — Issue 라벨 + 색 매핑.
// reason chip 카테고리: 명세 8색 (vol/news/frgn/disc/thm/pol/dday/new)
// + Phase A 가 추가 emit 하는 chg/reg/sub 까지 확장.

import type { IssueReasonTag, IssueWarning } from './types';

export const REASON_LABELS: Record<IssueReasonTag, string> = {
  vol:  '거래량',
  chg:  '등락폭',
  new:  '신선도',
  dday: 'D-day',
  reg:  '지역',
  sub:  '경쟁률',
  pol:  '규제',
  news: '뉴스',
  frgn: '외인',
  disc: '토론',
  thm:  '테마',
};

// chip 색 (background + text). 디자인 token.
// Architecture Rule #83 — hex 직접 사용 금지, 반드시 이 매핑 통과.
export const REASON_CHIP_STYLE: Record<IssueReasonTag, { background: string; color: string }> = {
  vol:  { background: '#FEF3C7', color: '#92400E' }, // amber
  chg:  { background: '#FEE2E2', color: '#991B1B' }, // red
  new:  { background: '#FEF3C7', color: '#92400E' }, // amber (신선도)
  dday: { background: '#FECACA', color: '#7F1D1D' }, // red-light (마감)
  reg:  { background: '#F1F5F9', color: '#475569' }, // slate
  sub:  { background: '#FED7AA', color: '#9A3412' }, // orange
  pol:  { background: '#FCE7F3', color: '#9D174D' }, // pink
  news: { background: '#DBEAFE', color: '#1E40AF' }, // blue
  frgn: { background: '#EDE9FE', color: '#5B21B6' }, // purple
  disc: { background: '#E0E7FF', color: '#3730A3' }, // indigo
  thm:  { background: '#DCFCE7', color: '#166534' }, // green
};

// warning 4종 — 모두 amber 톤 ⚠️
export const WARNING_LABELS: Record<IssueWarning, string> = {
  volatility_high: '변동성 높음',
  new_listing:     '신규 상장',
  managed_stock:   '관리종목',
  unsold_repeat:   '장기 미분양',
};

export const WARNING_STYLE = {
  background: '#FEF3C7',
  color:      '#92400E',
  border:     '#FCD34D',
};

// reason chip 표시 임계 (이 값 이하면 chip 안 그림 — 카드 노이즈 방지)
export const REASON_MIN_VALUE = 0.05;
