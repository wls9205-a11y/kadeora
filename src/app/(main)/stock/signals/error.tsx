'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px' }}>
      <p style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</p>
      <p style={{ marginBottom: '16px' }}>수급 시그널을 불러오는 중 오류가 발생했습니다.</p>
      <button onClick={reset} style={{
        padding: '8px 24px', borderRadius: '6px', border: 'none',
        background: 'var(--primary)', color: '#fff', cursor: 'pointer',
      }}>
        다시 시도
      </button>
    </div>
  );
}
