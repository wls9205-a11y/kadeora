export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: 100, height: 14, borderRadius: 4, background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <div style={{ width: '80%', height: 18, borderRadius: 4, background: 'var(--bg-hover)', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: '60%', height: 14, borderRadius: 4, background: 'var(--bg-hover)', marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 40, height: 12, borderRadius: 4, background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: 40, height: 12, borderRadius: 4, background: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
