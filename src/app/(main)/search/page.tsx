import type { Metadata } from "next";
import { Suspense } from "react";
import SearchPage from "./SearchClient";
export const metadata: Metadata = { title: "검색 — 카더라", description: "게시글 검색" };
export default function SearchPageWrapper() {
  return <Suspense fallback={<div className="text-center py-16 text-[#64748B]">로딩 중...</div>}><SearchPage /></Suspense>;
}
