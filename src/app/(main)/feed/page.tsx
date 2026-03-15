import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "피드 — 지금 뜨는 금융 이야기",
  description: "주식, 부동산, 청약 등 실시간 금융 커뮤니티 피드.",
};

interface FeedPageProps {
  searchParams: Promise<{ category?: string }>;
}

const DEMO_POSTS = [
  {
    id: 1, title: "삼성전자 실적 발표 후 전망 분석", content: "이번 분기 삼성전자 실적이 시장 예상치를 상회했습니다. 반도체 부문 회복세가 뚜렷하며, HBM 수주 확대로 내년 전망도 밝다는 분석이 나옵니다.",
    category: "stock", view_count: 2847, likes_count: 156, comments_count: 43, created_at: new Date(Date.now() - 3600000).toISOString(),
    profiles: { nickname: "투자의신", avatar_url: null },
  },
  {
    id: 2, title: "2026년 3월 수도권 청약 일정 총정리", content: "이번 달 주목할 만한 청약 단지들을 정리했습니다. 과천, 위례, 하남 등 주요 지역 분양 일정과 예상 경쟁률을 분석합니다.",
    category: "apt", view_count: 4231, likes_count: 289, comments_count: 67, created_at: new Date(Date.now() - 7200000).toISOString(),
    profiles: { nickname: "청약마스터", avatar_url: null },
  },
  {
    id: 3, title: "코스피 3000 돌파 가능성, 어떻게 보시나요?", content: "최근 외국인 매수세가 이어지면서 코스피가 2900선을 넘어섰습니다. 연내 3000 돌파에 대한 의견을 나눠봅시다.",
    category: "community", view_count: 1567, likes_count: 98, comments_count: 124, created_at: new Date(Date.now() - 10800000).toISOString(),
    profiles: { nickname: "시장관찰자", avatar_url: null },
  },
  {
    id: 4, title: "부동산 규제 완화 소식, 투자 전략 변경해야 할까?", content: "정부의 새로운 부동산 정책 발표가 예정되어 있습니다. 기존 규제 지역 해제와 대출 한도 조정이 핵심입니다.",
    category: "apt", view_count: 3102, likes_count: 201, comments_count: 89, created_at: new Date(Date.now() - 14400000).toISOString(),
    profiles: { nickname: "부동산학개론", avatar_url: null },
  },
  {
    id: 5, title: "신입 개미의 첫 배당주 투자 후기", content: "주식 시작한 지 6개월, 배당주 위주로 포트폴리오를 구성해봤습니다. 수익률과 배운 점을 공유합니다.",
    category: "free", view_count: 892, likes_count: 67, comments_count: 31, created_at: new Date(Date.now() - 18000000).toISOString(),
    profiles: { nickname: "초보개미", avatar_url: null },
  },
];

const DEMO_TRENDING = [
  { id: "t1", keyword: "삼성전자", heat_score: 95 },
  { id: "t2", keyword: "청약 경쟁률", heat_score: 88 },
  { id: "t3", keyword: "코스피 3000", heat_score: 82 },
  { id: "t4", keyword: "HBM", heat_score: 76 },
  { id: "t5", keyword: "배당주", heat_score: 71 },
  { id: "t6", keyword: "금리 인하", heat_score: 65 },
  { id: "t7", keyword: "과천 청약", heat_score: 58 },
  { id: "t8", keyword: "엔비디아", heat_score: 52 },
];

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const category = params.category || "all";

  return (
    <div className="pb-20">
      <nav className="text-[11px] text-[#475569] mb-4" aria-label="breadcrumb">
        <Link href="/" className="text-[#3B82F6] no-underline hover:underline">홈</Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span aria-current="page">피드</span>
      </nav>

      <Suspense fallback={<div className="h-[72px] rounded-[14px] bg-[#111827] mb-[18px] animate-pulse" />}>
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
  let trending = DEMO_TRENDING;

  try {
    const dbTrending = await unstable_cache(
      async () => {
        const sb = await createServerSupabaseClient();
        const { data } = await sb.from("trending_keywords").select("*").order("heat_score", { ascending: false }).limit(10);
        return data || [];
      },
      ["trending"],
      { revalidate: 60 }
    )();
    if (dbTrending.length > 0) trending = dbTrending;
  } catch {}

  return (
    <div className="bg-gradient-to-br from-[rgba(59,130,246,0.06)] to-[rgba(139,92,246,0.06)] border border-[rgba(59,130,246,0.12)] rounded-[14px] p-4 mb-[18px]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">🔥</span>
        <span className="text-[13px] font-bold text-[#F1F5F9]">지금 뜨는 키워드</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {trending.map((kw: { id: string; keyword: string; heat_score: number }, i: number) => (
          <Link key={kw.id} href={`/feed?q=${encodeURIComponent(kw.keyword)}`} className={`
            px-3 py-1 rounded-full no-underline text-xs font-semibold border transition-all hover:scale-105
            ${i < 3
              ? "bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#FCA5A5]"
              : "bg-[rgba(255,255,255,0.03)] border-[#1E293B] text-[#94A3B8]"
            }
          `}>
            <span className={`text-[10px] font-extrabold font-mono mr-1 ${i < 3 ? "text-[#EF4444]" : "text-[#64748B]"}`}>{i + 1}</span>
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
    <div className="flex gap-1.5 mb-3.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="카테고리 필터">
      {CATS.map((c) => (
        <Link key={c.value} href={c.value === "all" ? "/feed" : `/feed?category=${c.value}`}
          role="tab" aria-selected={current === c.value}
          className={`
            px-3.5 py-1.5 rounded-full no-underline whitespace-nowrap text-xs font-semibold border transition-all
            ${current === c.value
              ? "border-[#3B82F6] bg-[rgba(59,130,246,0.1)] text-[#93C5FD]"
              : "border-[#1E293B] bg-transparent text-[#64748B] hover:border-[#334155] hover:text-[#94A3B8]"
            }
          `}
        >{c.label}</Link>
      ))}
    </div>
  );
}

const CAT_COLORS: Record<string, string> = { stock: "#3B82F6", apt: "#10B981", community: "#8B5CF6", bug: "#EF4444", free: "#F59E0B" };
const CAT_LABELS: Record<string, string> = { stock: "주식", apt: "청약", community: "커뮤니티", bug: "버그", free: "자유" };

async function PostList({ category }: { category: string }) {
  let posts = DEMO_POSTS;
  let isDemo = true;

  try {
    const dbPosts = await unstable_cache(
      async () => {
        const sb = await createServerSupabaseClient();
        let q = sb.from("posts")
          .select("id, title, content, category, view_count, likes_count, comments_count, created_at, profiles(nickname, avatar_url)")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false }).limit(20);
        if (category !== "all") q = q.eq("category", category);
        const { data } = await q;
        return data || [];
      },
      [`posts-${category}`],
      { revalidate: 30 }
    )();
    if (dbPosts.length > 0) {
      posts = dbPosts as typeof DEMO_POSTS;
      isDemo = false;
    }
  } catch {}

  const filtered = isDemo && category !== "all"
    ? posts.filter((p) => p.category === category)
    : posts;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 bg-[#111827] rounded-2xl border border-[#1E293B]">
        <div className="text-[40px] mb-3">📝</div>
        <p className="text-[#94A3B8] text-sm mb-4">아직 게시글이 없습니다.</p>
        <Link href="/write" className="inline-block px-6 py-2.5 rounded-lg bg-[#3B82F6] text-white no-underline text-[13px] font-bold hover:bg-[#2563EB] transition-colors">
          첫 글 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {isDemo && (
        <div className="px-4 py-2.5 rounded-lg bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.12)] text-xs text-[#93C5FD] mb-1">
          💡 미리보기 데이터입니다. 로그인 후 직접 글을 작성해보세요!
        </div>
      )}
      {filtered.map((post, idx: number) => {
        const p = post as { id: number; title: string; content: string; category: string; view_count: number; likes_count: number; comments_count: number; created_at: string; profiles: { nickname: string; avatar_url: string | null } | null };
        const catColor = CAT_COLORS[p.category] || "#64748B";
        return (
          <article key={p.id} className="block rounded-[14px] bg-[#111827] border border-[#1E293B] p-4 hover:border-[#334155] hover:bg-[#0F1729] transition-all cursor-pointer group">
            <Link href={`/feed/${p.id}`} className="block no-underline">
              <div className="flex items-center gap-2 mb-2">
                {p.profiles?.avatar_url ? (
                  <Image src={p.profiles.avatar_url} alt={`${p.profiles.nickname} 프로필`} width={24} height={24} className="rounded-full" priority={idx === 0} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#1E293B] flex items-center justify-center text-[10px]">
                    {p.profiles?.nickname?.charAt(0) || "?"}
                  </div>
                )}
                <span className="text-[11px] font-semibold text-[#94A3B8]">{p.profiles?.nickname || "익명"}</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: `${catColor}15`, color: catColor }}>
                  {CAT_LABELS[p.category] || p.category}
                </span>
                <span className="text-[11px] text-[#334155] ml-auto">{timeAgo(p.created_at)}</span>
              </div>
              <h3 className="m-0 mb-1.5 text-[15px] font-bold text-[#F1F5F9] leading-snug group-hover:text-[#93C5FD] transition-colors">{p.title}</h3>
              <p className="m-0 text-[13px] text-[#94A3B8] leading-relaxed line-clamp-2">
                {(p.content as string).replace(/<[^>]*>/g, "")}
              </p>
              <div className="flex gap-3.5 mt-2.5 text-[11px] text-[#64748B]">
                <span>👁 {p.view_count.toLocaleString()}</span>
                <span>❤️ {p.likes_count}</span>
                <span>💬 {p.comments_count}</span>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function PostsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-[120px] rounded-[14px] bg-[#111827] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}
