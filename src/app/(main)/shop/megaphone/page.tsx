import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
export const metadata: Metadata = { title: "상점 — 카더라 메가폰", description: "게시글 부스트, 프리미엄 뱃지 등 카더라 아이템을 구매하세요." };
const DEMO = [
  { id:1, name:"메가폰 부스트", description:"게시글을 24시간 동안 피드 상단에 고정", price:3900, original_price:5900, icon:"📢", is_popular:true },
  { id:2, name:"프리미엄 뱃지", description:"닉네임 옆에 프리미엄 뱃지 30일 표시", price:9900, original_price:null, icon:"⭐", is_popular:true },
  { id:3, name:"메가 부스트", description:"72시간 상단 고정 + 하이라이트", price:8900, original_price:12900, icon:"🔥", is_popular:false },
  { id:4, name:"커스텀 프로필 프레임", description:"프로필 사진에 특별한 테두리 (30일)", price:4900, original_price:null, icon:"🎨", is_popular:false },
  { id:5, name:"닉네임 색상 변경", description:"닉네임 색상을 원하는 색으로 (30일)", price:2900, original_price:null, icon:"🌈", is_popular:false },
  { id:6, name:"토론방 개설권", description:"직접 토론 주제를 만들고 방 개설", price:1900, original_price:2900, icon:"💬", is_popular:true },
  { id:7, name:"VIP 종합 패키지", description:"프리미엄 뱃지 + 광고 제거 + 메가폰 3회", price:19900, original_price:29900, icon:"👑", is_popular:true },
  { id:8, name:"초보 탈출 패키지", description:"메가폰 1회 + 닉네임 색상 + 커스텀 프레임", price:7900, original_price:12700, icon:"🎁", is_popular:false },
];
export default async function ShopPage() {
  let products = DEMO; let isDemo = true;
  try { const db = await unstable_cache(async () => { const sb = await createServerSupabaseClient(); const { data } = await sb.from("shop_products").select("*").eq("is_active",true).order("is_popular",{ascending:false}); return data||[]; }, ["shop-products"], { revalidate:300 })(); if (db.length>0) { products=db as typeof DEMO; isDemo=false; } } catch {}
  const popular = products.filter((p) => p.is_popular);
  return (
    <div className="pb-20">
      <nav className="text-[11px] text-[#475569] mb-4"><Link href="/" className="text-[#3B82F6] no-underline hover:underline">홈</Link><span className="mx-1.5">/</span><span>상점</span></nav>
      <div className="mb-6"><h1 className="text-xl font-extrabold text-[#F1F5F9] m-0 mb-1">🛒 카더라 상점</h1><p className="text-[13px] text-[#64748B] m-0">게시글 부스트, 뱃지, 프리미엄 기능</p></div>
      {isDemo && <div className="px-4 py-2.5 rounded-lg bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.12)] text-xs text-[#93C5FD] mb-4">💡 상점 미리보기입니다.</div>}
      {popular.length>0 && <section className="mb-6"><h2 className="text-base font-bold text-[#F59E0B] mb-3">🔥 인기 상품</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{popular.map((p) => <PCard key={p.id} p={p} />)}</div></section>}
      <section><h2 className="text-base font-bold text-[#F1F5F9] mb-3">전체 상품</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{products.map((p) => <PCard key={p.id} p={p} />)}</div></section>
    </div>);
}
function PCard({ p }: { p: (typeof DEMO)[0] }) {
  const discount = p.original_price ? Math.round(((p.original_price-p.price)/p.original_price)*100) : 0;
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-[14px] p-4 hover:border-[#334155] transition-all">
      <div className="flex items-start gap-3"><div className="text-2xl">{p.icon}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><h3 className="m-0 text-[14px] font-bold text-[#F1F5F9] truncate">{p.name}</h3>{p.is_popular && <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.1)] text-[#F59E0B]">인기</span>}</div><p className="m-0 text-[12px] text-[#94A3B8] line-clamp-2">{p.description}</p><div className="flex items-center gap-2 mt-2">{discount>0 && <span className="text-[12px] font-bold text-[#EF4444]">{discount}%</span>}<span className="text-[15px] font-black text-[#F1F5F9]">{p.price.toLocaleString()}원</span>{p.original_price && <span className="text-[11px] text-[#475569] line-through">{p.original_price.toLocaleString()}원</span>}</div></div></div>
      <button className="w-full mt-3 py-2 rounded-lg bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] text-[#93C5FD] text-xs font-bold cursor-pointer hover:bg-[rgba(59,130,246,0.15)]">구매하기</button>
    </div>);
}
