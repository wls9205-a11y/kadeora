import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "실시간 토론방 — 지금 가장 뜨거운 주제",
  description: "주식, 부동산, 청약 관련 실시간 토론에 참여하세요. 커뮤니티와 함께 정보를 나눕니다.",
};

export default function DiscussPage() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", marginBottom: 20 }}>
        💬 실시간 토론방
      </h1>
      <div style={{
        textAlign: "center", padding: 60,
        background: "var(--kd-surface)", borderRadius: 16, border: "1px solid var(--kd-border)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
        <p style={{ color: "#94A3B8", fontSize: 14 }}>토론방 기능을 준비 중입니다.</p>
      </div>
    </div>
  );
}
