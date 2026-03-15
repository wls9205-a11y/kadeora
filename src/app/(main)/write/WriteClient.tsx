"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
const CATEGORIES = [{ value: "stock", label: "주식", icon: "📈" },{ value: "apt", label: "청약", icon: "🏢" },{ value: "community", label: "커뮤니티", icon: "💬" },{ value: "free", label: "자유", icon: "✏️" }];
export function WriteClient() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string }|null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => { setUser(user ? { id: user.id } : null); setAuthLoading(false); }); }, []);
  if (authLoading) return <div className="text-center py-16 text-[#64748B]">인증 확인 중...</div>;
  if (!user) return (<div className="max-w-[640px] mx-auto pb-20"><div className="text-center py-16 bg-[#111827] rounded-2xl border border-[#1E293B]"><div className="text-[48px] mb-4">🔒</div><h2 className="text-lg font-bold text-[#F1F5F9] mb-2">로그인이 필요합니다</h2><p className="text-[13px] text-[#64748B] mb-6">글을 작성하려면 먼저 로그인해주세요.</p><Link href="/login?redirect=/write" className="inline-block px-6 py-2.5 rounded-lg bg-[#3B82F6] text-white no-underline text-[13px] font-bold hover:bg-[#2563EB]">로그인하러 가기</Link></div></div>);
  const handleSubmit = async () => {
    if (!category||!title.trim()||!content.trim()) { setError("카테고리, 제목, 내용을 모두 입력해주세요."); return; }
    setSubmitting(true); setError(null);
    try {
      const { data, error: e } = await supabase.from("posts").insert({ user_id: user.id, category, title: title.trim(), content: content.trim(), view_count: 0, likes_count: 0, comments_count: 0, is_deleted: false }).select("id").single();
      if (e) throw e;
      if (data) router.push("/feed/"+data.id);
    } catch { setError("게시글 작성에 실패했습니다."); setSubmitting(false); }
  };
  return (
    <div className="max-w-[640px] mx-auto pb-20">
      <nav className="text-[11px] text-[#475569] mb-4"><Link href="/feed" className="text-[#3B82F6] no-underline hover:underline">피드</Link><span className="mx-1.5">/</span><span>글쓰기</span></nav>
      <h1 className="text-xl font-extrabold text-[#F1F5F9] m-0 mb-5">✏️ 새 글 작성</h1>
      <div className="mb-5"><label className="block text-[13px] font-semibold text-[#94A3B8] mb-2">카테고리</label><div className="flex gap-2 flex-wrap">{CATEGORIES.map((cat) => (<button key={cat.value} onClick={() => setCategory(cat.value)} className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all cursor-pointer bg-transparent ${category === cat.value ? "border-[#3B82F6] bg-[rgba(59,130,246,0.1)] text-[#93C5FD]" : "border-[#1E293B] text-[#64748B]"}`}>{cat.icon} {cat.label}</button>))}</div></div>
      <div className="mb-5"><label className="block text-[13px] font-semibold text-[#94A3B8] mb-2">제목</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" maxLength={100} className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-[#1E293B] text-[15px] text-[#F1F5F9] placeholder:text-[#475569] outline-none focus:border-[#3B82F6]" /><div className="text-right text-[11px] text-[#475569] mt-1">{title.length}/100</div></div>
      <div className="mb-5"><label className="block text-[13px] font-semibold text-[#94A3B8] mb-2">내용</label><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용을 입력하세요..." maxLength={5000} rows={12} className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-[#1E293B] text-[14px] text-[#E2E8F0] placeholder:text-[#475569] outline-none resize-y focus:border-[#3B82F6] leading-[1.8]" /><div className="text-right text-[11px] text-[#475569] mt-1">{content.length}/5000</div></div>
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#FCA5A5] text-[13px]">⚠️ {error}</div>}
      <div className="flex gap-3"><Link href="/feed" className="px-6 py-3 rounded-xl border border-[#334155] text-[#94A3B8] no-underline text-[13px] font-semibold">취소</Link><button onClick={handleSubmit} disabled={submitting||!category||!title.trim()||!content.trim()} className="flex-1 py-3 rounded-xl bg-[#3B82F6] text-white text-[14px] font-bold border-none cursor-pointer disabled:opacity-40 hover:bg-[#2563EB]">{submitting ? "등록 중..." : "게시글 등록"}</button></div>
    </div>);
}
