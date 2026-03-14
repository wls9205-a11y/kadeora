import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "상점 — 메가폰 & 아이템",
  description: "카더라 상점에서 메가폰, 배지, 프로필 효과 등 특별한 아이템을 구매하세요.",
};

export default function ShopPage() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", marginBottom: 20 }}>
        🛒 상점
      </h1>
      <div style={{
        textAlign: "center", padding: 60,
        background: "var(--kd-surface)", borderRadius: 16, border: "1px solid var(--kd-border)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
        <p style={{ color: "#94A3B8", fontSize: 14 }}>상점 아이템을 준비 중입니다.</p>
      </div>
    </div>
  );
}
