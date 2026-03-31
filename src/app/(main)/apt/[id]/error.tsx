'use client';
export default function AptError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-lg)' }}>🏢</div>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>페이지를 불러올 수 없습니다</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-2xl)' }}>잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침해 주세요.</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => reset()} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>다시 시도</button>
        <a href="/apt" style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600, fontSize: 'var(--fs-sm)', border: '1px solid var(--border)' }}>부동산 목록</a>
      </div>
    </div>
  );
}
