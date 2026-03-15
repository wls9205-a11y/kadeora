import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsClient } from "./NotificationsClient";
export const metadata: Metadata = { title: "알림 — 카더라", description: "내 알림을 확인하세요." };
export default function NotificationsPage() {
  return <Suspense fallback={<div className="text-center py-16 text-[#64748B]">로딩 중...</div>}><NotificationsClient /></Suspense>;
}
