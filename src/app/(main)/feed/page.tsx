import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";

/**
 * Abramov: "Suspense boundary가 너무 넓다 → Trending과 PostList를 분리"
 * Abramov: "필터를 searchParams로 관리 → 서버 재렌더링 트리거"
 */

export const metadata: Metadata = {
  title: "피드 — 지금 뜨는 금융 이야기",
  description: "주식, 부동산, 청약 등 실시간 금융 커뮤니티 피드.",
};

interface FeedPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const category = params.category || "all";

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Breadcrumb (Fishkin) */}
      <nav style={{ fontSize: 11, color: "#475569", marginBottom: 16 }} aria-label="breadcrumb">
        <Link href="/" style={{ color: "#3B82F6", textDecoration: "none" }}>홈</Link>
        <span style={{ margin: "0 6px" }} aria-hidden="true">/</span>
        <span aria-current="page">피드</span>
      </nav>

      {/* Independent Suspense for trending */}
      <Suspense fallback={<div style={{ height: 72, borderRadius: 14, background: "#111827", marginBottom: 18 }} />}>
        <TrendingWidget />
      </Suspense>

      {/* Category filter (server-driven via searchParams) */}
      <CategoryFilter current={category} />

      {/* Independent Suspense for posts */}
      <Suspense fallback={<PostsSkeleton />}>
        <PostList category={category} />
      </Suspense>
    </div>
  );
}

/** Trending keywords — separate data fetch + Suspense */
async function TrendingWidget() {
  const trending = await unstable_cache(
    async () => {
      const sb = await createServerSupabaseClient();
      const { data } = await sb.from("trending_keywords").select("*").order("heat_score", { ascending: false }).limit(10);
      return data || [];
    },
    ["trending"],
    { revalidate: 60 }
  )();

  if (trending.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.06) 100%)",
      border: "1px solid rgba(59,130,246,0.12)", borderRadius: 14, padding: "14px 18px", marginBottom: 18,
      minHeight: 72, /* Osmani: CLS 방어 */
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>🔥</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>지금 뜨는 키워드</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {trending.map((kw: { id: string; keyword: string; heat_score: number }, i: number) => (
          <Link key={kw.id} href={`/search?q=${encodeURIComponent(kw.keyword)}`} style={{
            padding: "5px 12px", borderRadius: 20, textDecoration: "none",
            background: i < 3 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${i < 3 ? "rgba(239,68,68,0.2)" : "#1E293B"}`,
            color: i < 3 ? "#FCA5A5" : "#94A3B8", fontSize: 12, fontWeight: 600,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: i < 3 ? "#EF4444" : "#64748B", fontFamily: "monospace", marginRight: 4 }}>{i + 1}</span>
            {kw.keyword}
          </Link>
        ))}
      </div>
    </div>
  );
}

const CATS = [
  { value: "all", label: "전체" }, { value: "stock", label: "주식" },
  { value: "apt", label: "청약" }, { value: "community", label: "커뮤니티" }, { value: "free", label: "자유" },
];

function CategoryFilter({ current }: { current: string }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }} role="tablist" aria-label="카테고리 필터">
      {CATS.map((c) => (
        <Link key={c.value} href={c.value === "all" ? "/feed" : `/feed?category=${c.value}`}
          role="tab" aria-selected={current === c.value}
          style={{
            padding: "7px 14px", borderRadius: 20, textDecoration: "none", whiteSpace: "nowrap",
            border: `1px solid ${current === c.value ? "#3B82F6" : "#1E293B"}`,
            background: current === c.value ? "rgba(59,130,246,0.1)" : "transparent",
            color: current === c.value ? "#93C5FD" : "#64748B", fontSize: 12, fontWeight: 600,
          }}
        >{c.label}</Link>
      ))}
    </div>
  );
}

const CAT_COLORS: Record<string, string> = { stock: "#3B82F6", apt: "#10B981", community: "#8B5CF6", bug: "#EF4444", free: "#F59E0B" };
const CAT_LABELS: Record<string, string> = { stock: "주식", apt: "청약", community: "커뮤니티", bug: "버그", free: "자유" };

/** Post list — separate data fetch */
async function PostList({ category }: { category: string }) {
  const posts = await unstable_cache(
    async () => {
      const sb = await createServerSupabaseClient();
      let q = sb.from("posts")
        .select("id, title, content, category, view_count, likes_count, comments_count, created_at, profiles(nickname, avatar_url)")
        .order("created_at", { ascending: false }).limit(20);
      if (category !== "all") q = q.eq("category", category);
      const { data } = await q;
      return data || [];
    },
    [`posts-${category}`],
    { revalidate: 30 }
  )();

  if (posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, background: "#111827", borderRadius: 16, border: "1px solid #1E293B" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
        <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 16px" }}>아직 게시글이 없습니다.</p>
        <Link href="/write" style={{ padding: "10px 24px", borderRadius: 8, background: "#3B82F6", color: "#FFF", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
          첫 글 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {posts.map((post: Record<string, unknown>, idx: number) => {
        const p = post as { id: number; title: string; content: string; category: string; view_count: number; likes_count: number; comments_count: number; created_at: string; profiles: { nickname: string; avatar_url: string | null } | null };
        return (
          <Link key={p.id} href={`/feed/${p.id}`} style={{ display: "block", textDecoration: "none", padding: "16px 18px", borderRadius: 14, background: "#111827", border: "1px solid #1E293B" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {p.profiles?.avatar_url && (
                <Image src={p.profiles.avatar_url} alt={`${p.profiles.nickname} 프로필`} width={24} height={24} style={{ borderRadius: "50%" }} priority={idx === 0} />
              )}
              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: `${CAT_COLORS[p.category] || "#64748B"}15`, color: CAT_COLORS[p.category] || "#64748B" }}>
                {CAT_LABELS[p.category] || p.category}
              </span>
              <span style={{ fontSize: 11, color: "#334155", marginLeft: "auto" }}>{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.4 }}>{p.title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {(p.content as string).replace(/<[^>]*>/g, "")}
            </p>
            <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: "#64748B" }}>
              <span>👁 {p.view_count.toLocaleString()}</span>
              <span>❤️ {p.likes_count}</span>
              <span>💬 {p.comments_count}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PostsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 120, borderRadius: 14, background: "#111827", animation: "pulse 2s infinite" }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
