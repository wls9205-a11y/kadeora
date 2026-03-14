import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { StockClient } from "./StockClient";

export const metadata: Metadata = {
  title: "주식 — 실시간 시세 & 커뮤니티",
  description: "실시간 주식 시세와 커뮤니티 관심 종목을 확인하세요.",
};

const getQuotes = unstable_cache(
  async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("stock_quotes")
      .select("*")
      .order("volume", { ascending: false })
      .limit(20);
    return data || [];
  },
  ["stock-quotes"],
  { revalidate: 30 }
);

export default async function StockPage() {
  const quotes = await getQuotes();
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#64748B" }}>불러오는 중...</div>}>
      <StockClient initialQuotes={quotes} />
    </Suspense>
  );
}
