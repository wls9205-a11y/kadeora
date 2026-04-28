// 서버 — 다음 sprint 예정인 /apt/map 진입 placeholder. 현재는 disabled.

interface Props {
  disabled?: boolean;
}

export default function AptMapCTA({ disabled = true }: Props) {
  return (
    <section
      aria-label="지도 모드"
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        style={{
          width: '100%', padding: '14px 16px',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border)', borderRadius: 12,
          fontSize: 13, fontWeight: 700,
          color: 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <span aria-hidden>🗺</span>
        <span>지도에서 보기</span>
        {disabled && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
            곧 출시
          </span>
        )}
      </button>
    </section>
  );
}
