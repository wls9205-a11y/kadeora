import type { Metadata } from "next";
import { Suspense } from "react";
import { WriteClient } from "./WriteClient";
export const metadata: Metadata = { title: "글쓰기 — 카더라", description: "새 게시글을 작성하세요." };
export default function WritePage() {
  return <Suspense fallback={<div className="text-center py-16 text-[#64748B]">로딩 중...</div>}><WriteClient /></Suspense>;
}
