'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('GlobalError:', error);
    try { import('@sentry/nextjs').then(Sentry => Sentry.captureException(error)); } catch {}
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin:0, fontFamily:'sans-serif', background:'var(--bg-base, #050A18)', color:'var(--text-primary, #E8EDF5)', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', textAlign:'center' }}>
        <div style={{ padding:'40px 20px' }}>
          <div style={{ fontSize:64, marginBottom:20 }}>💥</div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight:800, marginBottom:12 }}>서비스에 문제가 발생했습니다</h1>
          <p style={{ color:'var(--text-secondary, #94A8C4)', marginBottom:8 }}>잠시 후 다시 시도해주세요</p>
          {error.digest && <p style={{ fontSize:12, color:'var(--text-tertiary, #7D8DA3)', marginBottom:24 }}>오류 코드: {error.digest}</p>}
          <button onClick={reset} style={{ background:'var(--brand)', color:'var(--text-inverse, #fff)', border:'none', borderRadius:20, padding:'12px 32px', cursor:'pointer', fontWeight:700, fontSize:16, marginRight:12 }}>
            다시 시도
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global error boundary, router may be unavailable */}
          <a href="/feed" style={{ color:'var(--brand)', textDecoration:'none', fontSize:15 }}>홈으로</a>
        </div>
      </body>
    </html>
  );
}
