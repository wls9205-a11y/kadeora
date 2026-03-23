export default function SearchLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div className="skeleton-shimmer" style={{ height: 42, borderRadius: 10, marginBottom: 16 }} />
      <div className="skeleton-shimmer" style={{ height: 20, width: 120, borderRadius: 6, marginBottom: 12 }} />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 12, marginBottom: 10 }} />
      ))}
    </div>
  );
}
