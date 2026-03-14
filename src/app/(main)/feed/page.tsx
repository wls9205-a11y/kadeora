import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const metadata: Metadata = {
  title: "피드",
  description: "실시간 금융 커뮤니티 피드.",
};

export const dynamic = "force-dynamic";

function getClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
}

interface FeedPageProps { searchParams: Promise<{ category?: string }>; }

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const category = params.category || "all";
  return (
    <div style={{ paddingBottom: 80 }}>
      <Suspense fallback={<div style={{ height: 72, borderRadius: 14, background: "#111827", marginBottom: 18 }} />}>
        <TrendingWidget />
      </Suspense>
      <CategoryFilter current={category} />
      <Suspense fallback={<PostsSkeleton />}>
        <PostList category={category} />
      </Suspense>
    </div>
  );
}

async function TrendingWidget() {
  try {
    const { data } = await getClient().from("trending_keywords").select("*").order("heat_score", { ascending: false }).limit(10);
    if (!data || data.length === 0) return null;
    return (
      <div style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.06),rgba(139,92,246,0.06))", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>🔥</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>지금 뜨는 키워드</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {data.map((kw: {id:string;keyword:string}, i: number) => (
            <span key={kw.id} style={{ padding: "5px 12px", borderRadius: 20, background: i < 3 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)", border: "1px solid " + (i < 3 ? "rgba(239,68,68,0.2)" : "#1E293B"), color: i < 3 ? "#FCA5A5" : "#94A3B8", fontSize: 12, fontWeight: 600 }}>
              {i+1}. {kw.keyword}
            </span>
          ))}
        </div>
      </div>
    );
  } catch { return null; }
}

const CATS = [{value:"all",label:"전체"},{value:"stock",label:"주식"},{value:"apt",label:"청약"},{value:"community",label:"커뮤니티"},{value:"free",label:"자유"}];
const CAT_COLORS: Record<string,string> = {stock:"#3B82F6",apt:"#10B981",community:"#8B5CF6",bug:"#EF4444",free:"#F59E0B"};
const CAT_LABELS: Record<string,string> = {stock:"주식",apt:"청약",community:"커뮤니티",bug:"버그",free:"자유"};

function CategoryFilter({ current }: { current: string }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {CATS.map(c => (
        <Link key={c.value} href={c.value === "all" ? "/feed" : "/feed?category="+c.value} style={{ padding: "7px 14px", borderRadius: 20, textDecoration: "none", border: "1px solid " + (current===c.value?"#3B82F6":"#1E293B"), background: current===c.value?"rgba(59,130,246,0.1)":"transparent", color: current===c.value?"#93C5FD":"#64748B", fontSize: 12, fontWeight: 600 }}>{c.label}</Link>
      ))}
    </div>
  );
}

async function PostList({ category }: { category: string }) {
  try {
    let q = getClient().from("posts").select("id, title, content, category, view_count, likes_count, comments_count, created_at, profiles(nickname, avatar_url)").order("created_at", { ascending: false }).limit(20);
    if (category !== "all") q = q.eq("category", category);
    const { data } = await q;
    const posts = data || [];
    if (posts.length === 0) return (<div style={{ textAlign: "center", padding: 60, background: "#111827", borderRadius: 16 }}><p style={{ color: "#94A3B8" }}>아직 게시글이 없습니다.</p><Link href="/write" style={{ padding: "10px 24px", borderRadius: 8, background: "#3B82F6", color: "#FFF", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>첫 글 작성하기</Link></div>);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts.map((p: any) => (
          <Link key={p.id} href={"/feed/"+p.id} style={{ display: "block", textDecoration: "none", padding: "16px 18px", borderRadius: 14, background: "#111827", border: "1px solid #1E293B" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, color: CAT_COLORS[p.category]||"#64748B" }}>{CAT_LABELS[p.category]||p.category}</span>
              <span style={{ fontSize: 11, color: "#334155", marginLeft: "auto" }}>{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>{p.title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{String(p.content).replace(/<[^>]*>/g,"")}</p>
            <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: "#64748B" }}>
              <span>👁 {p.view_count}</span><span>❤️ {p.likes_count}</span><span>💬 {p.comments_count}</span>
            </div>
          </Link>
        ))}
      </div>
    );
  } catch { return <div style={{ textAlign: "center", padding: 60, background: "#111827", borderRadius: 16 }}><p style={{ color: "#94A3B8" }}>불러오기 실패</p></div>; }
}

function PostsSkeleton() {
  return (<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <div key={i} style={{ height: 120, borderRadius: 14, background: "#111827" }} />)}</div>);
}
