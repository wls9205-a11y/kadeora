export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ height: 24, width: '30%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 20 }} />
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ height: 40, background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 12 }} />
        <div style={{ height: 200, background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 12 }} />
        <div style={{ height: 40, width: 120, background: 'var(--bg-hover)', borderRadius: 8, marginLeft: 'auto' }} />
      </div>
    </div>
  );
}
