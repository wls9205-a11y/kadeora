export default function BlogDetailLoading() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ height: 14, width: 60, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 16 }} />
      <div style={{ height: 28, width: '80%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 14, width: '40%', background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: 22, width: 60, background: 'var(--bg-hover)', borderRadius: 999 }} />)}
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ height: 14, width: `${90 - i * 10}%`, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 10 }} />
      ))}
    </div>
  );
}
