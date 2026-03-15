"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
interface Comment { id: number; content: string; created_at: string; profiles: { nickname: string; avatar_url: string | null } | null; }
export function CommentSection({ postId, initialComments }: { postId: number; initialComments: Comment[] }) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async () => {
    if (!content.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("댓글을 작성하려면 로그인이 필요합니다."); setLoading(false); return; }
      const { data, error: insertError } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content: content.trim() }).select("id, content, created_at, profiles(nickname, avatar_url)").single();
      if (insertError) throw insertError;
      if (data) { setComments((prev) => [...prev, data as unknown as Comment]); setContent(""); }
    } catch { setError("댓글 작성에 실패했습니다."); } finally { setLoading(false); }
  };
  const formatDate = (d: string) => { const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff/60000); if (m<1) return "방금"; if (m<60) return m+"분 전"; const h = Math.floor(m/60); if (h<24) return h+"시간 전"; return new Date(d).toLocaleDateString("ko-KR"); };
  return (
    <div className="bg-[#111827] rounded-2xl border border-[#1E293B] p-6">
      <h2 className="text-base font-bold text-[#F1F5F9] mb-4">💬 댓글 {comments.length}개</h2>
      <div className="mb-5 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="댓글을 입력하세요..." maxLength={500} rows={3} className="w-full bg-transparent border-none outline-none resize-none text-[13px] text-[#E2E8F0] placeholder:text-[#475569] leading-relaxed" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-[#475569]">{content.length}/500</span>
          <button onClick={handleSubmit} disabled={!content.trim()||loading} className="px-4 py-1.5 rounded-lg bg-[#3B82F6] text-white text-xs font-bold border-none cursor-pointer disabled:opacity-40 hover:bg-[#2563EB] transition-colors">{loading ? "등록 중..." : "댓글 등록"}</button>
        </div>
        {error && <div className="mt-2 text-[12px] text-[#FCA5A5]">⚠️ {error}</div>}
      </div>
      {comments.length === 0 ? <p className="text-center py-8 text-[#64748B] text-sm">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p> : <div className="flex flex-col gap-3">{comments.map((c) => (<div key={c.id} className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]"><div className="flex items-center gap-2 mb-1.5"><div className="w-5 h-5 rounded-full bg-[#1E293B] flex items-center justify-center text-[9px] font-bold text-[#64748B]">{c.profiles?.nickname?.charAt(0)||"?"}</div><span className="text-xs font-semibold text-[#94A3B8]">{c.profiles?.nickname||"익명"}</span><span className="text-[10px] text-[#475569]">{formatDate(c.created_at)}</span></div><p className="m-0 text-[13px] text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{c.content}</p></div>))}</div>}
    </div>);
}
