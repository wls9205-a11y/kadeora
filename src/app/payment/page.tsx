import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentClient } from "./PaymentClient";

export const metadata: Metadata = { title: "결제", description: "카더라 상점 아이템 결제" };

export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#64748B" }}>로딩 중...</div>}>
      <PaymentClient />
    </Suspense>
  );
}
