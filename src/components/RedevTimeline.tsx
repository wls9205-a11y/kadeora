'use client';

const STAGES = [
  { key: '정비구역지정', label: '구역지정', color: 'var(--text-tertiary)', icon: '📋' },
  { key: '조합설립', label: '조합설립', color: 'var(--accent-blue)', icon: '🤝' },
  { key: '사업시행인가', label: '사업시행', color: 'var(--accent-yellow)', icon: '📜' },
  { key: '관리처분', label: '관리처분', color: '#F97316', icon: '⚖️' },
  { key: '착공', label: '착공', color: 'var(--accent-green)', icon: '🏗️' },
  { key: '준공', label: '준공', color: 'var(--brand)', icon: '🏢' },
];

export default function RedevTimeline({ currentStage }: { currentStage: string }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div style={{ margin: '12px 0 16px', overflow: 'hidden' }}>
      {/* 프로그레스 바 */}
      <div style={{ position: 'relative', height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 8 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2,
          width: `${((activeIdx + 1) / STAGES.length) * 100}%`,
          background: `linear-gradient(90deg, ${STAGES[0].color}, ${STAGES[activeIdx].color})`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* 스테이지 라벨 */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {STAGES.map((s, i) => {
          const isPast = i < activeIdx;
          const isCurrent = i === activeIdx;
          const _isFuture = i > activeIdx;
          return (
            <div key={s.key} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, minWidth: 0,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCurrent ? s.color : isPast ? `${s.color}40` : 'var(--bg-hover)',
                border: isCurrent ? `2px solid ${s.color}` : isPast ? 'none' : '1px solid var(--border)',
                fontSize: 12, marginBottom: 3,
                boxShadow: isCurrent ? `0 0 8px ${s.color}60` : 'none',
                transition: 'all 0.3s',
              }}>
                {isCurrent ? s.icon : isPast ? '✓' : ''}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isCurrent ? 800 : 500, textAlign: 'center',
                color: isCurrent ? s.color : isPast ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                lineHeight: 1.2,
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
