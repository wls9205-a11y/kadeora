/** Kent: "loading.tsx 라우트별로 생성하여 로딩 UI 통일" */
export default function MainLoading() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{textAlign:'center', padding:'60px 20px'}}>
        <div style={{fontSize:48, marginBottom:16}}>📡</div>
        <p style={{color:'var(--text-secondary)', fontSize:14}}>잠시만요...</p>
      </div>
      <div style={{ height: 16, width: 100, borderRadius: 8, background: "var(--bg-surface)", marginBottom: 16 }} />
      <div style={{ height: 72, borderRadius: 12, background: "var(--bg-surface)", marginBottom: 18, animation: "pulse 2s infinite" }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 70, height: 34, borderRadius: 20, background: "var(--bg-surface)" }} />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 120, borderRadius: 12, background: "var(--bg-surface)", marginBottom: 10, animation: "pulse 2s infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
