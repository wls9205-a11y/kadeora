import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
  description: "카더라에 로그인하세요.",
};

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0A0E17", padding: 20,
    }}>
      <div style={{
        maxWidth: 400, width: "100%", background: "#111827", borderRadius: 20,
        border: "1px solid #1E293B", padding: 40, textAlign: "center",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#3B82F6", margin: "0 0 4px" }}>카더라</h1>
        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 32px" }}>진짜 정보가 오가는 금융 커뮤니티</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button style={{
            padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
            background: "#FEE500", color: "#000", fontSize: 14, fontWeight: 700,
          }}>
            🗨️ 카카오로 시작하기
          </button>

          <button style={{
            padding: "14px", borderRadius: 12, border: "1px solid #334155", cursor: "pointer",
            background: "transparent", color: "#E2E8F0", fontSize: 14, fontWeight: 700,
          }}>
            G 구글로 시작하기
          </button>

          <div style={{
            display: "flex", alignItems: "center", gap: 12, margin: "8px 0",
          }}>
            <div style={{ flex: 1, height: 1, background: "#1E293B" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>또는</span>
            <div style={{ flex: 1, height: 1, background: "#1E293B" }} />
          </div>

          <button style={{
            padding: "14px", borderRadius: 12, border: "1px solid #334155", cursor: "pointer",
            background: "transparent", color: "#94A3B8", fontSize: 14, fontWeight: 600,
          }}>
            📱 전화번호로 시작하기
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#475569", marginTop: 24, lineHeight: 1.6 }}>
          시작하면{" "}
          <a href="/terms" style={{ color: "#3B82F6" }}>이용약관</a> 및{" "}
          <a href="/privacy" style={{ color: "#3B82F6" }}>개인정보처리방침</a>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
