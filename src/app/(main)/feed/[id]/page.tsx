import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const CAT_COLORS: Record<string, string> = { stock: "#3B82F6", apt: "#10B981", community: "#8B5CF6", bug: "#EF4444", free: "#F59E0B" };
const CAT_LABELS: Record<string, string> = { stock: "주식", apt: "청약", community: "커뮤니티", bug: "버그", free: "자유" };

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("posts").select("title, content, category").eq("id", id).single();
    if (data) {
      return {
        title: data.title,
        description: (data.content as string).replace(/<[^>]*>/g, "").slice(0, 160),
        openGraph: { images: [`/api/og?title=${encodeURIComponent(data.title)}&category=${data.category}`] },
      };
    }
  } catch {}
  return { title: "게시글" };
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  let post = null;
  let comments: Array<{ id: number; content: string; created_at: string; profiles: { nickname: string; avatar_url: string | null } | null }> = [];

  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("posts").select("*, profiles(nickname, avatar_url)").eq("id", id).eq("is_deleted", false).single();
    if (data) {
      post = data;
      await supabase.from("posts").update({ view_count: (data.view_count || 0) + 1 }).eq("id", id);
      const { data: commentsData } = await supabase.from("comments").select("id, content, created_at, profiles(nickname, avatar_url)").eq("post_id", id).eq("is_deleted", false).order("created_at", { ascending: true });
      if (commentsData) comments = commentsData as typeof comments;
    }
  } catch {}

  if (!post) {
    const demoId = parseInt(id);
    if (demoId >= 1 && demoId <= 5) {
      return (
        <div className="max-w-[720px] mx-auto pb-20">
          <nav className="text-[11px] text-[#475569] mb-4" aria-label="breadcrumb">
            <Link href="/feed" className="text-[#3B82F6] no-underline">피드</Link>
            <span className="mx-1.5">/</span><span>미리보기</span>
          </nav>
          <div className="text-center py-16 bg-[#111827] rounded-2xl border border-[#1E293B]">
            <div className="text-[40px] mb-3">👀</div>
            <p className="text-[#94A3B8] text-sm mb-2">미리보기 데이터입니다.</p>
            <p className="text-[#64748B] text-xs mb-4">실제 게시글은 글을 작성한 후 확인할 수 있습니다.</p>
            <Link href="/feed" className="inline-block px-5 py-2 rounded-lg bg-[#3B82F6] text-white no-underline text-[13px] font-bold">피드로 돌아가기</Link>
          </div>
        </div>
      );
    }
    notFound();
  }

  const catColor = CAT_COLORS[post.category] || "#64748B";

  return (
    <article className="max-w-[720px] mx-auto pb-20">
      <nav className="text-[11px] text-[#475569] mb-4" aria-label="breadcrumb">
        <Link href="/feed" className="text-[#3B82F6] no-underline hover:underline">피드</Link>
        <span className="mx-1.5">/</span><span>{CAT_LABELS[post.category] || "게시글"}</span>
      </nav>
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ background: `${catColor}15`, color: catColor }}>{CAT_LABELS[post.category] || post.category}</span>
          <span className="text-[11px] text-[#475569]">{new Date(post.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
        <h1 className="text-xl font-extrabold text-[#F1F5F9] mb-4 leading-snug">{post.title}</h1>
        <div className="flex items-center gap-3 pb-4 border-b border-[#1E293B] mb-4">
          {post.profiles?.avatar_url ? (
            <Image src={post.profiles.avatar_url} alt="" width={32} height={32} className="rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center text-xs font-bold text-[#64748B]">{post.profiles?.nickname?.charAt(0) || "?"}</div>
          )}
          <div><div className="text-[13px] font-semibold text-[#E2E8F0]">{post.profiles?.nickname || "익명"}</div></div>
        </div>
        <div className="text-[14px] text-[#CBD5E1] leading-[1.8] whitespace-pre-wrap">{(post.content as string).replace(/<[^>]*>/g, "")}</div>
        {post.images && post.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {post.images.map((url: string, i: number) => (
              <Image key={i} src={url} alt={`첨부 이미지 ${i + 1}`} width={300} height={200} className="rounded-lg object-cover border border-[#1E293B]" />
            ))}
          </div>
        )}
        <div className="flex gap-4 mt-6 pt-4 border-t border-[#1E293B] text-sm text-[#64748B]">
          <span>👁 {(post.view_count || 0).toLocaleString()}</span><span>❤️ {post.likes_count || 0}</span><span>💬 {post.comments_count || 0}</span>
        </div>
      </div>
      <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6">
        <h2 className="text-base font-bold text-[#F1F5F9] mb-4">💬 댓글 {comments.length}개</h2>
        {comments.length === 0 ? (
          <p className="text-center py-8 text-[#64748B] text-sm">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#94A3B8]">{c.profiles?.nickname || "익명"}</span>
                  <span className="text-[10px] text-[#475569]">{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className="m-0 text-[13px] text-[#CBD5E1] leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}