"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
interface Notification { id:number; type:string; title:string; body:string; link:string|null; is_read:boolean; created_at:string; }
const TYPE_ICONS: Record<string,string> = { comment:"💬", like:"❤️", follow:"👤", system:"🔔", mention:"📢", achievement:"🏆" };
const DEMO: Notification[] = [
  { id:1, type:"comment", title:"새 댓글", body:"투자의신님이 회원님의 글에 댓글을 남겼습니다.", link:"/feed/1", is_read:false, created_at:new Date(Date.now()-1800000).toISOString() },
  { id:2, type:"like", title:"좋아요", body:"청약마스터님이 회원님의 글을 좋아합니다.", link:"/feed/2", is_read:false, created_at:new Date(Date.now()-3600000).toISOString() },
  { id:3, type:"system", title:"시스템 알림", body:"이용약관이 업데이트되었습니다.", link:"/terms", is_read:true, created_at:new Date(Date.now()-86400000).toISOString() },
  { id:4, type:"achievement", title:"등급 승급", body:"축하합니다! 브론즈 등급으로 승급했습니다.", link:null, is_read:true, created_at:new Date(Date.now()-172800000).toISOString() },
  { id:5, type:"like", title:"좋아요", body:"시장관찰자님 외 3명이 회원님의 글을 좋아합니다.", link:"/feed/3", is_read:true, created_at:new Date(Date.now()-259200000).toISOString() },
];
export function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { const load = async () => { const supabase = createClient(); const { data:{user} } = await supabase.auth.getUser(); if (user) { setIsLoggedIn(true); try { const { data } = await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30); if (data&&data.length>0) setNotifications(data as Notification[]); else setNotifications(DEMO); } catch { setNotifications(DEMO); } } else { setNotifications(DEMO); } setLoading(false); }; load(); }, []);
  const markAllRead = async () => { setNotifications((p) => p.map((n) => ({...n,is_read:true}))); };
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const fmt = (d:string) => { const diff=Date.now()-new Date(d).getTime(); const m=Math.floor(diff/60000); if(m<1)return"방금"; if(m<60)return m+"분 전"; const h=Math.floor(m/60); if(h<24)return h+"시간 전"; const dd=Math.floor(h/24); if(dd<30)return dd+"일 전"; return new Date(d).toLocaleDateString("ko-KR"); };
  return (
    <div className="pb-20">
      <nav className="text-[11px] text-[#475569] mb-4"><Link href="/feed" className="text-[#3B82F6] no-underline hover:underline">피드</Link><span className="mx-1.5">/</span><span>알림</span></nav>
      <div className="flex items-center justify-between mb-5"><div><h1 className="text-xl font-extrabold text-[#F1F5F9] m-0 mb-0.5">🔔 알림</h1>{unreadCount>0 && <p className="text-[12px] text-[#93C5FD] m-0">읽지 않은 알림 {unreadCount}개</p>}</div>{unreadCount>0 && <button onClick={markAllRead} className="px-3 py-1.5 rounded-lg bg-transparent border border-[#1E293B] text-[11px] text-[#94A3B8] cursor-pointer hover:border-[#334155]">모두 읽음</button>}</div>
      {!isLoggedIn && <div className="px-4 py-2.5 rounded-lg bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.12)] text-xs text-[#93C5FD] mb-4">💡 미리보기 데이터입니다.</div>}
      {loading ? <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-[72px] rounded-xl bg-[#111827] animate-pulse" />)}</div> : notifications.length===0 ? <div className="text-center py-16 bg-[#111827] rounded-2xl border border-[#1E293B]"><div className="text-[40px] mb-3">🔔</div><p className="text-[#94A3B8] text-sm">알림이 없습니다.</p></div> : <div className="flex flex-col gap-1.5">{notifications.map((n) => { const icon=TYPE_ICONS[n.type]||"🔔"; const inner = <><span className="text-lg mt-0.5">{icon}</span><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><span className="text-[12px] font-semibold text-[#E2E8F0]">{n.title}</span>{!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />}</div><p className="m-0 text-[12px] text-[#94A3B8] leading-relaxed">{n.body}</p><span className="text-[10px] text-[#475569] mt-1 block">{fmt(n.created_at)}</span></div></>; return n.link ? <Link key={n.id} href={n.link} className={`flex items-start gap-3 p-3.5 rounded-xl no-underline transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.03)] ${n.is_read ? "bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)]" : "bg-[rgba(59,130,246,0.04)] border border-[rgba(59,130,246,0.1)]"}`}>{inner}</Link> : <div key={n.id} className={`flex items-start gap-3 p-3.5 rounded-xl ${n.is_read ? "bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)]" : "bg-[rgba(59,130,246,0.04)] border border-[rgba(59,130,246,0.1)]"}`}>{inner}</div>; })}</div>}
    </div>);
}
