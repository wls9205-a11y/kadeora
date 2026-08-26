'use client';

interface EngageRowProps {
  views?: number;
  comments?: number;
  interest?: number;
  style?: React.CSSProperties;
}

// ⚠️ 조회·댓글·관심 세 색은 «제 배경이 없는» 컴포넌트라 흰 카드 위에 그대로 얹힌다.
//    #22D3EE 1.81 · #FFD43B 1.43 으로 하한 미달이었다 — 형제인 --accent-purple(5.70)만
//    어두운 값이었다(TY1-2 의 --accent-blue 와 같은 패턴).
//    기존 토큰 --accent-cyan(7.27) · --accent-yellow(6.85)로 맞췄다.
export default function EngageRow({ views, comments, interest, style }: EngageRowProps) {
  if (!views && !comments && !interest) return null;

  const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      padding: '7px 12px 9px', borderTop: '1px solid var(--border)', ...style,
    }}>
      {(views !== undefined && views > 0) && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--accent-cyan)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          {fmt(views)}
        </span>
      )}
      {(views !== undefined && views > 0 && ((comments !== undefined && comments > 0) || (interest !== undefined && interest > 0))) && (
        <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
      )}
      {(comments !== undefined && comments > 0) && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--accent-purple)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {fmt(comments)}
        </span>
      )}
      {(comments !== undefined && comments > 0 && interest !== undefined && interest > 0) && (
        <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
      )}
      {(interest !== undefined && interest > 0) && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--accent-yellow)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          {fmt(interest)}
        </span>
      )}
    </div>
  );
}
