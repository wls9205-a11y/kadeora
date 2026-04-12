export default function Loading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px var(--sp-lg)' }}>
      <div style={{ height: 28, width: 200, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', marginBottom: 8 }} />
      <div style={{ height: 14, width: 300, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', marginBottom: 24 }} />
      <div style={{ height: 200, borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', marginBottom: 14, animation: 'pulse 2s infinite' }} />
      <div style={{ height: 150, borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', animation: 'pulse 2s infinite', animationDelay: '0.2s' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
