import type { Metadata } from "next";
import { PaymentClient } from "./PaymentClient";

export const metadata: Metadata = {
  title: "결제",
  description: "카더라 상점 아이템 결제",
};

export default function PaymentPage() {
  return <PaymentClient />;
}
