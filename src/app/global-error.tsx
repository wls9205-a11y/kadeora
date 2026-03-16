'use client';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: 'var(--bg-base, #0A0E17)', fontFamily: 'Pretendard, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 480 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚡</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #F1F5F9)', margin: '0 0 8px' }}>예상치 못한 오류가 발생했어요</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #94A3B8)', margin: '0 0 8px', lineHeight: 1.6 }}>페이지를 새로고침하거나 잠시 후 다시 시도해주세요.</p>
          {error.digest && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', fontFamily: 'monospace', marginBottom: 24 }}>오류 코드: {error.digest}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={reset} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--brand, #FF4500)', color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              🔄 다시 시도
            </button>
            <button onClick={() => window.location.href = '/'} style={{ padding: '11px 24px', borderRadius: 10, border: '1px solid var(--border, #1E293B)', background: 'transparent', color: 'var(--text-secondary, #94A3B8)', fontSize: 14, cursor: 'pointer' }}>
              🏠 홈으로
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}