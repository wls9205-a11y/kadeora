export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-md)' }}>
          <div style={{ height: 14, width: '60%', background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 12, width: '90%', background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ height: 12, width: '40%', background: 'var(--bg-hover)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}
