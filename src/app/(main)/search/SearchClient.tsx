"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
const CAT_COLORS: Record<string,string> = { stock:"#3B82F6", apt:"#10B981", community:"#8B5CF6", free:"#F59E0B" };
const CAT_LABELS: Record<string,string> = { stock:"주식", apt:"청약", community:"커뮤니티", free:"자유" };
interface Post { id:number; title:string; content:string; category:string; view_count:number; likes_count:number; comments_count:number; created_at:string; profiles:{nickname:string}|null; }
export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")||"";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const doSearch = useCallback(async (q:string) => {
    if (!q.trim()) return; setLoading(true); setSearched(true);
    try { const supabase = createClient(); const { data } = await supabase.from("posts").select("id,title,content,category,view_count,likes_count,comments_count,created_at,profiles(nickname)").eq("is_deleted",false).or("title.ilike.%"+q+"%,content.ilike.%"+q+"%").order("created_at",{ascending:false}).limit(30); setResults((data||[]) as Post[]); } catch { setResults([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (initialQuery) doSearch(initialQuery); }, [initialQuery, doSearch]);
  const handleSubmit = (e:React.FormEvent) => { e.preventDefault(); doSearch(query); };
  return (
    <div className="pb-20">
      <nav className="text-[11px] text-[#475569] mb-4"><Link href="/feed" className="text-[#3B82F6] no-underline hover:underline">피드</Link><span className="mx-1.5">/</span><span>검색</span></nav>
      <h1 className="text-xl font-extrabold text-[#F1F5F9] m-0 mb-5">🔍 검색</h1>
      <form onSubmit={handleSubmit} className="mb-6"><div className="flex gap-2"><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색어를 입력하세요" className="flex-1 px-4 py-3 rounded-xl bg-[#111827] border border-[#1E293B] text-[14px] text-[#F1F5F9] placeholder:text-[#475569] outline-none focus:border-[#3B82F6]" /><button type="submit" disabled={loading||!query.trim()} className="px-5 py-3 rounded-xl bg-[#3B82F6] text-white text-[13px] font-bold border-none cursor-pointer disabled:opacity-40 hover:bg-[#2563EB]">{loading?"...":"검색"}</button></div></form>
      {loading ? <div className="flex flex-col gap-2.5">{[1,2,3].map((i) => <div key={i} className="h-[100px] rounded-[14px] bg-[#111827] animate-pulse" />)}</div> : searched ? (results.length===0 ? <div className="text-center py-16 bg-[#111827] rounded-2xl border border-[#1E293B]"><div className="text-[40px] mb-3">🔍</div><p className="text-[#94A3B8] text-sm">검색 결과가 없습니다.</p></div> : <div><p className="text-[12px] text-[#64748B] mb-3">검색 결과 <span className="text-[#93C5FD] font-bold">{results.length}</span>건</p><div className="flex flex-col gap-2.5">{results.map((p) => { const cc=CAT_COLORS[p.category]||"#64748B"; return <Link key={p.id} href={"/feed/"+p.id} className="block rounded-[14px] bg-[#111827] border border-[#1E293B] p-4 no-underline hover:border-[#334155] transition-all"><div className="flex items-center gap-2 mb-1.5"><span className="px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{background:cc+"15",color:cc}}>{CAT_LABELS[p.category]||p.category}</span><span className="text-[11px] text-[#475569]">{p.profiles?.nickname||"익명"}</span></div><h3 className="m-0 mb-1 text-[14px] font-bold text-[#F1F5F9]">{p.title}</h3><p className="m-0 text-[12px] text-[#94A3B8] line-clamp-2">{p.content.replace(/<[^>]*>/g,"").slice(0,120)}</p><div className="flex gap-3 mt-2 text-[11px] text-[#64748B]"><span>👁 {(p.view_count||0).toLocaleString()}</span><span>❤️ {p.likes_count||0}</span><span>💬 {p.comments_count||0}</span></div></Link>; })}</div></div>) : <div className="text-center py-16 text-[#475569] text-sm">키워드를 입력하고 검색해보세요.</div>}
    </div>);
}
