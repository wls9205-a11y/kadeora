export default function Loading() {
  return (
    <div style={{ padding:16 }}>
      <div style={{textAlign:'center', padding:'60px 20px'}}>
        <div style={{fontSize:48, marginBottom:16}}>📡</div>
        <p style={{color:'var(--text-secondary)', fontSize:14}}>잠시만요...</p>
      </div>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton" style={{ height:120, borderRadius:4, marginBottom:10, width:'100%' }} />
      ))}
    </div>
  );
}
