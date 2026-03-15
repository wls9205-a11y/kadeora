import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { StockClient } from "./StockClient";

export const metadata: Metadata = {
  title: "주식 — 실시간 시세 & 커뮤니티",
  description: "실시간 주식 시세와 커뮤니티 관심 종목을 확인하세요.",
};

const DEMO_QUOTES = [
  { symbol: "005930", name: "삼성전자", market: "KOSPI", price: 83200, change_amt: 1200, change_pct: 1.46, volume: 18234567, updated_at: new Date().toISOString() },
  { symbol: "000660", name: "SK하이닉스", market: "KOSPI", price: 178500, change_amt: 3500, change_pct: 2.00, volume: 5678901, updated_at: new Date().toISOString() },
  { symbol: "373220", name: "LG에너지솔루션", market: "KOSPI", price: 412000, change_amt: -5000, change_pct: -1.20, volume: 892345, updated_at: new Date().toISOString() },
  { symbol: "005380", name: "현대차", market: "KOSPI", price: 267500, change_amt: 2000, change_pct: 0.75, volume: 2345678, updated_at: new Date().toISOString() },
  { symbol: "035420", name: "NAVER", market: "KOSPI", price: 226000, change_amt: -1500, change_pct: -0.66, volume: 1567890, updated_at: new Date().toISOString() },
  { symbol: "035720", name: "카카오", market: "KOSPI", price: 56700, change_amt: 800, change_pct: 1.43, volume: 3456789, updated_at: new Date().toISOString() },
  { symbol: "051910", name: "LG화학", market: "KOSPI", price: 398000, change_amt: -7000, change_pct: -1.73, volume: 678901, updated_at: new Date().toISOString() },
  { symbol: "006400", name: "삼성SDI", market: "KOSPI", price: 421500, change_amt: 5500, change_pct: 1.32, volume: 456789, updated_at: new Date().toISOString() },
  { symbol: "028260", name: "삼성물산", market: "KOSPI", price: 158000, change_amt: -500, change_pct: -0.32, volume: 345678, updated_at: new Date().toISOString() },
  { symbol: "105560", name: "KB금융", market: "KOSPI", price: 82300, change_amt: 1100, change_pct: 1.36, volume: 2123456, updated_at: new Date().toISOString() },
];

async function getQuotes() {
  try {
    const dbQuotes = await unstable_cache(
      async () => {
        const supabase = await createServerSupabaseClient();
        const { data } = await supabase.from("stock_quotes").select("*").order("volume", { ascending: false }).limit(20);
        return data || [];
      },
      ["stock-quotes"],
      { revalidate: 30 }
    )();
    return dbQuotes.length > 0 ? dbQuotes : DEMO_QUOTES;
  } catch {
    return DEMO_QUOTES;
  }
}

export default async function StockPage() {
  const quotes = await getQuotes();
  return (
    <Suspense fallback={<div className="text-center py-16 text-[#64748B]">불러오는 중...</div>}>
      <StockClient initialQuotes={quotes} />
    </Suspense>
  );
}
