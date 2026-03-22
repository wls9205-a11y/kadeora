export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ height: 12, width: 60, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 16 }} />
      <div style={{ height: 24, width: '70%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 14, width: '40%', background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 20 }} />
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 12 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 12, width: `${95 - i * 12}%`, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 8 }} />
        ))}
      </div>
    </div>
  );
}
