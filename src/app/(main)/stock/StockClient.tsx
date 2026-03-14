"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

interface Quote {
  symbol: string; name: string; market: string; price: number | null;
  change_amt: number | null; change_pct: number | null; volume: number | null; updated_at: string;
}

export function StockClient({ initialQuotes }: { initialQuotes: Quote[] }) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("stock-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "stock_quotes",
      }, (payload) => {
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          const updated = payload.new as Quote;
          setQuotes((prev) =>
            prev.map((q) => (q.symbol === updated.symbol ? updated : q))
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <nav style={{ fontSize: 11, color: "#475569", marginBottom: 16 }} aria-label="breadcrumb">
        <Link href="/" style={{ color: "#3B82F6", textDecoration: "none" }}>홈</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span>주식</span>
      </nav>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", margin: 0 }}>📈 주식 시세</h1>
        <span style={{ fontSize: 11, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
          실시간
        </span>
      </div>
      {quotes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#111827", borderRadius: 16, border: "1px solid #1E293B" }}>
          <p style={{ color: "#94A3B8" }}>시세 데이터가 없습니다.</p>
        </div>
      ) : (
        <div style={{ background: "#111827", borderRadius: 16, border: "1px solid #1E293B", overflow: "hidden" }} role="table" aria-label="주식 시세 목록">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px", padding: "12px 20px", borderBottom: "1px solid #1E293B", fontSize: 11, fontWeight: 700, color: "#64748B" }} role="row">
            <span role="columnheader">종목</span>
            <span role="columnheader" style={{ textAlign: "right" }}>현재가</span>
            <span role="columnheader" style={{ textAlign: "right" }}>등락률</span>
            <span role="columnheader" style={{ textAlign: "right" }}>거래량</span>
          </div>
          {quotes.map((q) => {
            const pct = q.change_pct ?? 0;
            return (
              <div key={q.symbol} role="row" style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px", padding: "14px 20px", borderBottom: "1px solid rgba(30,41,59,0.5)", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>{q.name}</div><div style={{ fontSize: 11, color: "#475569" }}>{q.symbol}</div></div>
                <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "#F1F5F9", fontFamily: "monospace" }}>{(q.price ?? 0).toLocaleString()}</div>
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: pct > 0 ? "#EF4444" : pct < 0 ? "#3B82F6" : "#64748B" }}>
                  {pct > 0 ? "+" : ""}{Number(pct).toFixed(2)}%
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "#64748B", fontFamily: "monospace" }}>{Math.round((q.volume ?? 0) / 1000)}K</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
