// [S10-2] 경보함 — admin_alerts 를 화면에 올린다.
//
// 이 화면이 생기기 전까지 admin_alerts 를 읽는 코드가 0개였다.
// 크론 6개 + cron-logger 가 쓰기만 하고 아무도 보지 않았다.
//
// CriticalAlertBar(RPC 집계 1줄)와 역할이 다르다:
//   바   = 지금 당장 봐야 하는 것, 타입별 집계
//   여기 = 개별 경보 원문 + 트리아지

import type { Metadata } from 'next';
import AlertsClient from './AlertsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '경보함 | 카더라 어드민',
  robots: { index: false, follow: false },
};

export default function AdminAlertsPage() {
  return <AlertsClient />;
}
