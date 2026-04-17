export default function Loading() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ height: '28px', width: '200px', background: 'var(--bg-secondary)', borderRadius: '6px', marginBottom: '12px' }} />
      <div style={{ height: '16px', width: '400px', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '24px' }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: '140px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          marginBottom: '16px',
          animation: 'pulse 1.5s ease infinite',
        }} />
      ))}
    </div>
  );
}
