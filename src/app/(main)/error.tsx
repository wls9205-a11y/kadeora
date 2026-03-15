"use client";

/** Per-route Error Boundary for (main) group */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😵</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--kd-text)", marginBottom: 8 }}>
        페이지를 불러올 수 없습니다
      </h2>
      <p style={{ fontSize: 13, color: "var(--kd-text-muted)", marginBottom: 20 }}>
        네트워크 연결을 확인하고 다시 시도해주세요.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 20px", borderRadius: 8, border: "none",
          background: "var(--kd-primary)", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
