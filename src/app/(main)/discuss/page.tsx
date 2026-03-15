import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DiscussClient } from "./DiscussClient";
export const metadata: Metadata = { title: "토론 — 실시간 금융 토론방", description: "실시간 금융 토론에 참여하세요." };
const DEMO_ROOMS = [
  { id: 1, title: "삼성전자 목표가 토론", description: "삼성전자 연말 목표가는? 10만전자 가능할까?", category: "stock", participant_count: 234, message_count: 1567, is_hot: true, created_at: new Date(Date.now()-86400000).toISOString() },
  { id: 2, title: "2026 코스피 전망", description: "올해 코스피 3000 돌파 가능성, 어떻게 보시나요?", category: "stock", participant_count: 189, message_count: 892, is_hot: true, created_at: new Date(Date.now()-172800000).toISOString() },
  { id: 3, title: "과천 신도시 분양가 적정성", description: "과천 분양가가 너무 높다 vs 입지 감안하면 합리적", category: "apt", participant_count: 156, message_count: 723, is_hot: false, created_at: new Date(Date.now()-259200000).toISOString() },
  { id: 4, title: "배당주 vs 성장주", description: "30대 직장인, 배당주와 성장주 중 어디에 투자?", category: "stock", participant_count: 312, message_count: 2103, is_hot: true, created_at: new Date(Date.now()-345600000).toISOString() },
  { id: 5, title: "서울 vs 경기 실거주", description: "예산 8억, 서울 외곽 vs 경기 핵심지", category: "apt", participant_count: 98, message_count: 456, is_hot: false, created_at: new Date(Date.now()-432000000).toISOString() },
  { id: 6, title: "미국 금리 인하 시점 예측", description: "Fed 금리 인하 시기와 한국 증시 영향", category: "stock", participant_count: 145, message_count: 678, is_hot: false, created_at: new Date(Date.now()-518400000).toISOString() },
  { id: 7, title: "전세 vs 월세 vs 매매", description: "현 시점 가장 합리적인 주거 전략은?", category: "apt", participant_count: 267, message_count: 1234, is_hot: true, created_at: new Date(Date.now()-604800000).toISOString() },
  { id: 8, title: "AI 관련주 투자 전략", description: "엔비디아, SK하이닉스 등 AI 수혜주 분석", category: "stock", participant_count: 201, message_count: 945, is_hot: false, created_at: new Date(Date.now()-691200000).toISOString() },
  { id: 9, title: "초보 투자자 Q&A", description: "주식, 부동산 초보자들의 질문과 답변", category: "free", participant_count: 534, message_count: 3456, is_hot: true, created_at: new Date(Date.now()-777600000).toISOString() },
  { id: 10, title: "재테크 도서 추천", description: "읽어볼 만한 재테크 도서 추천", category: "free", participant_count: 87, message_count: 234, is_hot: false, created_at: new Date(Date.now()-864000000).toISOString() },
];
export default async function DiscussPage() {
  let rooms = DEMO_ROOMS; let isDemo = true;
  try { const dbRooms = await unstable_cache(async () => { const sb = await createServerSupabaseClient(); const { data } = await sb.from("discussion_rooms").select("*").order("message_count", { ascending: false }).limit(20); return data || []; }, ["discuss-rooms"], { revalidate: 60 })(); if (dbRooms.length > 0) { rooms = dbRooms as typeof DEMO_ROOMS; isDemo = false; } } catch {}
  return <Suspense fallback={<div className="text-center py-16 text-[#64748B]">불러오는 중...</div>}><DiscussClient rooms={rooms} isDemo={isDemo} /></Suspense>;
}
