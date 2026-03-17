export default function Loading() {
  return (
    <div style={{ padding: 16 }}>
      {/* Header skeleton */}
      <div className="skeleton" style={{ height: 28, width: 200, borderRadius: 4, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 300, borderRadius: 4, marginBottom: 16 }} />
      {/* Filter bar skeleton */}
      <div className="skeleton" style={{ height: 44, borderRadius: 4, marginBottom: 10, width: '100%' }} />
      {/* Table rows skeleton */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} className="skeleton" style={{
          height: 52,
          borderRadius: 4,
          marginBottom: 2,
          width: '100%',
          animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
        }} />
      ))}
    </div>
  );
}
