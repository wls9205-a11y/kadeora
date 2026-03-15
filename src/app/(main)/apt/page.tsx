import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";

export const metadata: Metadata = {
  title: "청약 — 실시간 청약 일정 & 경쟁률",
  description: "아파트 청약 일정, 경쟁률, 분양 정보를 한눈에 확인하세요.",
};

const DEMO_SUBSCRIPTIONS = [
  { id: 1, name: "과천 위버필드 센트럴", region: "경기 과천시", developer: "대우건설", total_units: 1480, subscription_start: "2026-03-18", subscription_end: "2026-03-20", announcement_date: "2026-03-28", move_in_date: "2028-09", price_range: "7.5억 ~ 13.2억", competition_rate: 156.3, status: "upcoming", house_type: "59㎡, 74㎡, 84㎡" },
  { id: 2, name: "위례 포레스티엘", region: "경기 하남시", developer: "현대건설", total_units: 920, subscription_start: "2026-03-10", subscription_end: "2026-03-12", announcement_date: "2026-03-20", move_in_date: "2028-06", price_range: "8.2억 ~ 14.5억", competition_rate: 203.7, status: "ongoing", house_type: "59㎡, 84㎡, 101㎡" },
  { id: 3, name: "하남 미사 리슈빌", region: "경기 하남시", developer: "롯데건설", total_units: 756, subscription_start: "2026-03-05", subscription_end: "2026-03-07", announcement_date: "2026-03-14", move_in_date: "2028-03", price_range: "6.8억 ~ 11.7억", competition_rate: 89.2, status: "closed", house_type: "59㎡, 74㎡, 84㎡" },
  { id: 4, name: "인천 청라 블루오션", region: "인천 서구", developer: "포스코이앤씨", total_units: 2100, subscription_start: "2026-03-24", subscription_end: "2026-03-26", announcement_date: "2026-04-03", move_in_date: "2028-12", price_range: "4.5억 ~ 8.9억", competition_rate: null, status: "upcoming", house_type: "59㎡, 74㎡, 84㎡, 101㎡" },
  { id: 5, name: "서울 노원 꿈의숲 아이파크", region: "서울 노원구", developer: "HDC현대산업개발", total_units: 540, subscription_start: "2026-03-25", subscription_end: "2026-03-27", announcement_date: "2026-04-04", move_in_date: "2029-01", price_range: "9.1억 ~ 15.8억", competition_rate: null, status: "upcoming", house_type: "59㎡, 84㎡" },
  { id: 6, name: "광명 시흥 신도시 1단지", region: "경기 광명시", developer: "GS건설", total_units: 3200, subscription_start: "2026-02-24", subscription_end: "2026-02-26", announcement_date: "2026-03-06", move_in_date: "2028-09", price_range: "5.2억 ~ 10.1억", competition_rate: 312.5, status: "closed", house_type: "49㎡, 59㎡, 74㎡, 84㎡" },
];

const DEMO_SCHEDULES = [
  { date: "2026-03-18", event: "과천 위버필드 센트럴 특별공급", type: "special" },
  { date: "2026-03-19", event: "과천 위버필드 센트럴 1순위", type: "first" },
  { date: "2026-03-20", event: "과천 위버필드 센트럴 2순위", type: "second" },
  { date: "2026-03-24", event: "인천 청라 블루오션 특별공급", type: "special" },
  { date: "2026-03-25", event: "서울 노원 꿈의숲 아이파크 특별공급", type: "special" },
  { date: "2026-03-26", event: "인천 청라 블루오션 1순위", type: "first" },
  { date: "2026-03-27", event: "서울 노원 꿈의숲 아이파크 1순위", type: "first" },
  { date: "2026-03-28", event: "과천 위버필드 센트럴 당첨자 발표", type: "result" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "접수예정", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  ongoing: { label: "접수중", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  closed: { label: "접수마감", color: "#64748B", bg: "rgba(100,116,139,0.1)" },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  special: { label: "특별공급", color: "#8B5CF6" },
  first: { label: "1순위", color: "#3B82F6" },
  second: { label: "2순위", color: "#F59E0B" },
  result: { label: "당첨발표", color: "#EF4444" },
};

export default async function AptPage() {
  let subscriptions = DEMO_SUBSCRIPTIONS;
  let isDemo = true;
  try {
    const dbData = await unstable_cache(async () => {
      const sb = await createServerSupabaseClient();
      const { data } = await sb.from("apt_subscriptions").select("*").order("subscription_start", { ascending: true }).limit(20);
      return data || [];
    }, ["apt-subscriptions"], { revalidate: 300 })();
    if (dbData.length > 0) { subscriptions = dbData as typeof DEMO_SUBSCRIPTIONS; isDemo = false; }
  } catch {}
  const upcoming = subscriptions.filter((s) => s.status === "upcoming");
  const ongoing = subscriptions.filter((s) => s.status === "ongoing");
  const closed = subscriptions.filter((s) => s.status === "closed");

  return (
    <div className="pb-20">
      <nav className="text-[11px] text-[#475569] mb-4" aria-label="breadcrumb">
        <Link href="/" className="text-[#3B82F6] no-underline hover:underline">홈</Link>
        <span className="mx-1.5">/</span><span aria-current="page">청약</span>
      </nav>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-[#F1F5F9] m-0 mb-1">🏢 청약 정보</h1>
        <p className="text-[13px] text-[#64748B] m-0">아파트 청약 일정과 경쟁률을 한눈에</p>
      </div>
      {isDemo && (<div className="px-4 py-2.5 rounded-lg bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.12)] text-xs text-[#93C5FD] mb-4">💡 미리보기 데이터입니다. 실제 청약 정보는 applyhome.co.kr에서 확인해주세요.</div>)}
      <Suspense fallback={<div className="h-[200px] bg-[#111827] rounded-2xl animate-pulse mb-6" />}><ScheduleTimeline /></Suspense>
      {ongoing.length > 0 && (<section className="mb-6"><h2 className="text-base font-bold text-[#10B981] mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />접수중</h2><div className="flex flex-col gap-3">{ongoing.map((s) => (<SubscriptionCard key={s.id} item={s} />))}</div></section>)}
      {upcoming.length > 0 && (<section className="mb-6"><h2 className="text-base font-bold text-[#3B82F6] mb-3">📅 접수 예정</h2><div className="flex flex-col gap-3">{upcoming.map((s) => (<SubscriptionCard key={s.id} item={s} />))}</div></section>)}
      {closed.length > 0 && (<section className="mb-6"><h2 className="text-base font-bold text-[#64748B] mb-3">✅ 접수 마감</h2><div className="flex flex-col gap-3">{closed.map((s) => (<SubscriptionCard key={s.id} item={s} />))}</div></section>)}
    </div>
  );
}

function SubscriptionCard({ item }: { item: (typeof DEMO_SUBSCRIPTIONS)[0] }) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.upcoming;
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-[14px] p-4 hover:border-[#334155] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: status.bg, color: status.color }}>{status.label}</span>
            <span className="text-[11px] text-[#475569]">{item.region}</span>
          </div>
          <h3 className="m-0 text-[15px] font-bold text-[#F1F5F9] leading-snug">{item.name}</h3>
          <p className="m-0 mt-1 text-[12px] text-[#64748B]">{item.developer} · {item.house_type}</p>
        </div>
        {item.competition_rate && (<div className="text-right ml-3"><div className="text-[11px] text-[#64748B]">경쟁률</div><div className="text-lg font-black text-[#F59E0B]">{item.competition_rate.toFixed(1)}<span className="text-[11px] text-[#64748B]">:1</span></div></div>)}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
        <div><div className="text-[10px] text-[#64748B] mb-0.5">청약일</div><div className="text-[12px] font-semibold text-[#CBD5E1]">{item.subscription_start} ~ {item.subscription_end.slice(5)}</div></div>
        <div><div className="text-[10px] text-[#64748B] mb-0.5">당첨발표</div><div className="text-[12px] font-semibold text-[#CBD5E1]">{item.announcement_date}</div></div>
        <div><div className="text-[10px] text-[#64748B] mb-0.5">총세대</div><div className="text-[12px] font-semibold text-[#CBD5E1]">{item.total_units.toLocaleString()}세대</div></div>
        <div><div className="text-[10px] text-[#64748B] mb-0.5">분양가</div><div className="text-[12px] font-semibold text-[#CBD5E1]">{item.price_range}</div></div>
      </div>
    </div>
  );
}

async function ScheduleTimeline() {
  let schedules = DEMO_SCHEDULES;
  try {
    const dbSchedules = await unstable_cache(async () => {
      const sb = await createServerSupabaseClient();
      const { data } = await sb.from("subscription_schedules").select("*").gte("date", new Date().toISOString().slice(0, 10)).order("date", { ascending: true }).limit(10);
      return data || [];
    }, ["apt-schedules"], { revalidate: 300 })();
    if (dbSchedules.length > 0) schedules = dbSchedules as typeof DEMO_SCHEDULES;
  } catch {}
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-[14px] p-4 mb-6">
      <h2 className="text-sm font-bold text-[#F1F5F9] mb-3">📆 이번 달 청약 일정</h2>
      <div className="flex flex-col gap-2">
        {schedules.map((s, i) => {
          const type = TYPE_CONFIG[s.type] || TYPE_CONFIG.special;
          const dayStr = new Date(s.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
          return (<div key={i} className="flex items-center gap-3 py-1.5"><div className="w-[72px] text-[11px] font-semibold text-[#94A3B8] shrink-0">{dayStr}</div><span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ background: `${type.color}15`, color: type.color }}>{type.label}</span><span className="text-[12px] text-[#CBD5E1] truncate">{s.event}</span></div>);
        })}
      </div>
    </div>
  );
}
