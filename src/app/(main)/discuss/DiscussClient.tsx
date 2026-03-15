"use client";
import { useState } from "react";
import Link from "next/link";
interface Room { id: number; title: string; description: string; category: string; participant_count: number; message_count: number; is_hot: boolean; created_at: string; }
const CAT_FILTERS = [{ value: "all", label: "전체" },{ value: "stock", label: "주식" },{ value: "apt", label: "부동산" },{ value: "free", label: "자유" }];
const CAT_COLORS: Record<string, string> = { stock: "#3B82F6", apt: "#10B981", free: "#F59E0B" };
const CAT_LABELS: Record<string, string> = { stock: "주식", apt: "부동산", free: "자유" };
export function DiscussClient({ rooms, isDemo }: { rooms: Room[]; isDemo: boolean }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"hot"|"recent"|"popular">("hot");
  const filtered = rooms.filter((r) => filter === "all" || r.category === filter).sort((a, b) => { if (sort === "hot") { if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1; return b.message_count - a.message_count; } if (sort === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); return b.participant_count - a.participant_count; });
  return (
    <div className="pb-20">
      <nav className="text-[11px] text-[#475569] mb-4" aria-label="breadcrumb"><Link href="/" className="text-[#3B82F6] no-underline hover:underline">홈</Link><span className="mx-1.5">/</span><span>토론</span></nav>
      <div className="mb-5"><h1 className="text-xl font-extrabold text-[#F1F5F9] m-0 mb-1">💬 토론방</h1><p className="text-[13px] text-[#64748B] m-0">실시간 금융 토론에 참여하세요</p></div>
      {isDemo && <div className="px-4 py-2.5 rounded-lg bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.12)] text-xs text-[#93C5FD] mb-4">💡 미리보기 데이터입니다.</div>}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">{CAT_FILTERS.map((c) => (<button key={c.value} onClick={() => setFilter(c.value)} className={`px-3.5 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold border transition-all cursor-pointer bg-transparent ${filter === c.value ? "border-[#3B82F6] bg-[rgba(59,130,246,0.1)] text-[#93C5FD]" : "border-[#1E293B] text-[#64748B]"}`}>{c.label}</button>))}</div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-[#111827] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-[11px] text-[#94A3B8] outline-none cursor-pointer"><option value="hot">🔥 인기순</option><option value="recent">🕐 최신순</option><option value="popular">👥 참여순</option></select>
      </div>
      <div className="flex flex-col gap-2.5">{filtered.map((room) => { const catColor = CAT_COLORS[room.category] || "#64748B"; return (<div key={room.id} className="bg-[#111827] border border-[#1E293B] rounded-[14px] p-4 hover:border-[#334155] transition-all cursor-pointer group"><div className="flex items-center gap-2 mb-2">{room.is_hot && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(239,68,68,0.1)] text-[#FCA5A5]">🔥 HOT</span>}<span className="px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: catColor+"15", color: catColor }}>{CAT_LABELS[room.category]||room.category}</span></div><h3 className="m-0 mb-1.5 text-[15px] font-bold text-[#F1F5F9] group-hover:text-[#93C5FD] transition-colors">{room.title}</h3><p className="m-0 text-[13px] text-[#94A3B8] line-clamp-2">{room.description}</p><div className="flex gap-4 mt-3 text-[11px] text-[#64748B]"><span>👥 {room.participant_count.toLocaleString()}명</span><span>💬 {room.message_count.toLocaleString()}개</span></div></div>); })}</div>
    </div>);
}
