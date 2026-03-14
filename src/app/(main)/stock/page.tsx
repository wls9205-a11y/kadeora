import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { StockClient } from "./StockClient";

export const metadata: Metadata = { title: "주식", description: "실시간 주식 시세" };
export const dynamic = "force-dynamic";

export default async function StockPage() {
  let quotes: any[] = [];
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||"", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"");
    const { data } = await sb.from("stock_quotes").select("*").order("volume", { ascending: false }).limit(20);
    quotes = data || [];
  } catch {}
  return (<Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#64748B" }}>불러오는 중...</div>}><StockClient initialQuotes={quotes} /></Suspense>);
}
