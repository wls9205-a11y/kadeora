import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "청약 정보 — 전국 아파트 청약 일정",
  description: "전국 아파트 청약 일정과 경쟁률, 분양가 정보를 확인하세요. 내 지역 맞춤 청약 알림을 받아보세요.",
};

export default function AptPage() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", marginBottom: 20 }}>
        🏢 청약 정보
      </h1>
      <div style={{
        textAlign: "center", padding: 60,
        background: "var(--kd-surface)", borderRadius: 16, border: "1px solid var(--kd-border)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
        <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 8px" }}>
          청약 정보 페이지를 준비 중입니다.
        </p>
        <p style={{ color: "#64748B", fontSize: 12 }}>
          전국 청약 일정, 경쟁률, 분양가 비교 기능이 곧 제공됩니다.
        </p>
      </div>
    </div>
  );
}
