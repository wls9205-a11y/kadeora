export default function Loading() {
  return (
    <div style={{ padding:16 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton" style={{ height:120, borderRadius:12, marginBottom:10, width:'100%' }} />
      ))}
    </div>
  );
}
