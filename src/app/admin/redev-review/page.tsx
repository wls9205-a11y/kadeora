// ADDENDUM §2 — DART 정비사업 검수 큐.
//
// 자동 반영이 확신하지 못한 공시를 사람이 판정한다.
// ⚠️ 큐가 0건인 날이 정상이다 — 진짜 정비사업 공시는 하루 1~2건이고,
//    철도·인프라 공급계약은 본문 필터가 걸러 여기까지 오지 않는다.
//    그래서 승인·반려 이력도 탭으로 본다(규칙을 고칠 근거가 거기 있다).

import type { Metadata } from 'next';
import ReviewQueueClient from './ReviewQueueClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '정비사업 공시 검수 | 카더라 어드민',
  robots: { index: false, follow: false },
};

export default function AdminRedevReviewPage() {
  return <ReviewQueueClient />;
}
