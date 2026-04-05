'use client';
export default function CalcError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px var(--sp-lg)', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, marginBottom: 8 }}>계산기 오류</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 24 }}>
        {error.message || '계산기를 불러오는 중 오류가 발생했습니다.'}
      </p>
      <button onClick={reset} style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
        다시 시도
      </button>
    </div>
  );
}
