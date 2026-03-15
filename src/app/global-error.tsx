"use client";

/**
 * Kent C. Dodds: "Error Boundary 없으면 전체 앱이 하얀 화면으로 사망한다"
 * 전역 에러 바운더리 + 복구 버튼
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{
        background: "var(--kd-bg)", color: "var(--kd-text)",
        fontFamily: "'Pretendard Variable', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", padding: 20, margin: 0,
      }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            문제가 발생했습니다
          </h1>
          <p style={{ fontSize: 14, color: "var(--kd-text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
            일시적인 오류입니다. 아래 버튼을 눌러 다시 시도해주세요.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: "var(--kd-text-dim)", fontFamily: "monospace", marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "12px 24px", borderRadius: 10, border: "none",
                background: "var(--kd-primary)", color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            <a
              href="/"
              style={{
                padding: "12px 24px", borderRadius: 10, textDecoration: "none",
                border: "1px solid #334155", color: "var(--kd-text-muted)", fontSize: 14,
                display: "inline-flex", alignItems: "center",
              }}
            >
              홈으로
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
