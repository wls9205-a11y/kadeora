import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "./LoginClient";
export const metadata: Metadata = { title: "로그인", description: "카더라에 로그인하세요." };
export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0A0E17]"><div className="text-[#64748B] text-sm">로딩 중...</div></div>}><LoginClient /></Suspense>;
}
