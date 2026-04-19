/**
 * BlogHeroExtras — 제목 아래 TLDR 박스 + key_points 그리드 + 읽기 시간 배지
 *
 * 서버 컴포넌트로도 사용 가능 (순수 렌더). 데이터는 모두 props 로.
 */

interface Props {
  tldr?: string | null;
  keyPoints?: Array<string | { text: string }> | null;
  readingMinutes?: number | null;
  readingTimeMinFallback?: number | null;
}

export default function BlogHeroExtras({ tldr, keyPoints, readingMinutes, readingTimeMinFallback }: Props) {
  const min = readingMinutes || readingTimeMinFallback || null;
  const hasTldr = tldr && tldr.trim().length > 0;
  const points: string[] = Array.isArray(keyPoints)
    ? (keyPoints as any[]).map((k) => (typeof k === 'string' ? k : String(k?.text ?? ''))).filter(Boolean).slice(0, 6)
    : [];

  if (!hasTldr && points.length === 0 && !min) return null;

  return (
    <div style={{ margin: '0 0 20px' }}>
      {hasTldr && (
        <div
          style={{
            position: 'relative',
            background: 'rgba(251, 191, 36, 0.08)',
            borderLeft: '3px solid #FBBF24',
            padding: '14px 16px',
            borderRadius: 6,
            marginBottom: points.length ? 14 : 0,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span aria-hidden style={{ fontSize: 18, lineHeight: '24px' }}>💡</span>
          <div style={{ flex: 1, fontSize: 14, color: 'var(--text-primary, #e5e7eb)', lineHeight: 1.6 }}>{tldr}</div>
          {min && (
            <span style={{
              whiteSpace: 'nowrap',
              fontSize: 11, fontWeight: 700,
              background: 'rgba(251,191,36,0.2)', color: '#FBBF24',
              padding: '3px 8px', borderRadius: 999,
            }}>⏱ {min}분</span>
          )}
        </div>
      )}

      {points.length > 0 && (
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: 14,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: 10, letterSpacing: '-0.3px' }}>
            📌 한눈에 보기
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 8,
          }}>
            {points.map((pt, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  fontSize: 13,
                  color: 'var(--text-primary, #e5e7eb)',
                  lineHeight: 1.5,
                }}
              >
                <span style={{
                  flexShrink: 0,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#8b5cf6', color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}>{i + 1}</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
