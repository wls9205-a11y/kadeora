import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "프로필",
  description: "카더라 사용자 프로필",
};

export default function ProfilePage() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", marginBottom: 20 }}>
        👤 프로필
      </h1>
      <div style={{
        textAlign: "center", padding: 60,
        background: "var(--kd-surface)", borderRadius: 16, border: "1px solid var(--kd-border)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p style={{ color: "#94A3B8", fontSize: 14 }}>프로필 페이지를 준비 중입니다.</p>
      </div>
    </div>
  );
}
