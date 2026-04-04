/** 라우트별 로딩 UI — 스켈레톤만 표시 (크롤러에 텍스트 노출 방지) */
export default function MainLoading() {
  return (
    <div style={{ paddingBottom: 80 }} aria-busy="true" aria-label="로딩 중">
      <div style={{ height: 16, width: 100, borderRadius: 'var(--radius-sm)', background: "var(--bg-surface)", marginBottom: 'var(--sp-lg)', marginTop: 60 }} />
      <div style={{ height: 72, borderRadius: 'var(--radius-card)', background: "var(--bg-surface)", marginBottom: 18, animation: "pulse 2s infinite" }} />
      <div style={{ display: "flex", gap: 'var(--sp-sm)', marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 70, height: 34, borderRadius: 'var(--radius-xl)', background: "var(--bg-surface)" }} />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 120, borderRadius: 'var(--radius-card)', background: "var(--bg-surface)", marginBottom: 10, animation: "pulse 2s infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
