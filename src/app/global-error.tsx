"use client";

/**
 * Kent C. Dodds: "Error Boundary ?놁쑝硫??꾩껜 ?깆씠 ?섏? ?붾㈃?쇰줈 ?щ쭩?쒕떎"
 * ?꾩뿭 ?먮윭 諛붿슫?붾━ + 蹂듦뎄 踰꾪듉
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
        background: "#0A0E17", color: "#F1F5F9",
        fontFamily: "'Pretendard Variable', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", padding: 20, margin: 0,
      }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>?좑툘</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            臾몄젣媛 諛쒖깮?덉뒿?덈떎
          </h1>
          <p style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24, lineHeight: 1.6 }}>
            ?쇱떆?곸씤 ?ㅻ쪟?낅땲?? ?꾨옒 踰꾪듉???뚮윭 ?ㅼ떆 ?쒕룄?댁＜?몄슂.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "12px 24px", borderRadius: 10, border: "none",
                background: "#3B82F6", color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              ?ㅼ떆 ?쒕룄
            </button>
            <a
              href="/"
              style={{
                padding: "12px 24px", borderRadius: 10, textDecoration: "none",
                border: "1px solid #334155", color: "#94A3B8", fontSize: 14,
                display: "inline-flex", alignItems: "center",
              }}
            >
              ?덉쑝濡?
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

