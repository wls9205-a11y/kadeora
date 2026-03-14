/** Kent: "loading.tsx 라우트별로 생성하여 로딩 UI 통일" */
export default function MainLoading() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ height: 16, width: 100, borderRadius: 4, background: "#111827", marginBottom: 16 }} />
      <div style={{ height: 72, borderRadius: 14, background: "#111827", marginBottom: 18, animation: "pulse 2s infinite" }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 70, height: 34, borderRadius: 20, background: "#111827" }} />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 120, borderRadius: 14, background: "#111827", marginBottom: 10, animation: "pulse 2s infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
