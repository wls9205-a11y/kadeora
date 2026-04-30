/**
 * PhaseStepper
 *
 * 재개발 7단계 진행 stepper. 데스크톱은 가로, 모바일은 세로 stack.
 * 재개발 탭의 시그니처 위젯.
 */

import { REDEV_PHASES, phaseIndex } from '../utils';

type Props = {
  currentPhaseId: string;
  nextMilestoneLabel?: string;
  nextMilestoneDDay?: number;
};

export function PhaseStepper({
  currentPhaseId,
  nextMilestoneLabel,
  nextMilestoneDDay,
}: Props) {
  const currentIdx = phaseIndex(currentPhaseId);
  const totalSteps = REDEV_PHASES.length;
  const progressPct = currentIdx >= 0 ? ((currentIdx + 0.5) / totalSteps) * 100 : 0;

  return (
    <div
      style={{
        background: 'var(--aptr-bg-card)',
        border: '0.5px solid var(--aptr-border-subtle)',
        borderRadius: 'var(--aptr-radius-md)',
        padding: '14px',
        boxShadow: 'var(--aptr-shadow-card)',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: 'var(--aptr-text-tertiary)',
          letterSpacing: '0.3px',
          marginBottom: '14px',
        }}
      >
        진행 단계
      </div>

      {/* 데스크톱: 가로 stepper */}
      <div className="aptr-stepper-horizontal" style={{ position: 'relative' }}>
        {/* 배경 라인 */}
        <div
          style={{
            position: 'absolute',
            top: '11px',
            left: '8px',
            right: '8px',
            height: '2px',
            background: 'var(--aptr-badge-gray-bg)',
          }}
        />
        {/* 진행 라인 */}
        <div
          style={{
            position: 'absolute',
            top: '11px',
            left: '8px',
            width: `calc(${progressPct}% - 8px)`,
            height: '2px',
            background: 'var(--aptr-tab-redevelopment)',
            transition: 'width 0.3s ease',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `repeat(${totalSteps}, 1fr)`,
            gap: 0,
          }}
        >
          {REDEV_PHASES.map((phase, idx) => {
            const completed = idx < currentIdx;
            const current = idx === currentIdx;
            const upcoming = idx > currentIdx;

            return (
              <div key={phase.id} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    margin: '0 auto 8px',
                    background: completed
                      ? 'var(--aptr-tab-redevelopment)'
                      : current
                      ? 'var(--aptr-bg-card)'
                      : 'var(--aptr-badge-gray-bg)',
                    border: current ? '2px solid var(--aptr-tab-redevelopment)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '10px',
                  }}
                >
                  {completed ? '✓' : ''}
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    color: current
                      ? 'var(--aptr-tab-redevelopment)'
                      : completed
                      ? 'var(--aptr-text-primary)'
                      : 'var(--aptr-text-tertiary)',
                    fontWeight: current || completed ? 500 : 400,
                    wordBreak: 'keep-all',
                    lineHeight: 1.3,
                  }}
                >
                  {phase.label}
                </div>
                {current && nextMilestoneDDay ? (
                  <div
                    className="aptr-num"
                    style={{
                      fontSize: '9px',
                      color: 'var(--aptr-tab-redevelopment)',
                      fontWeight: 500,
                      marginTop: '2px',
                    }}
                  >
                    D-{nextMilestoneDDay}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .aptr-stepper-horizontal > div:first-child {
            display: none;
          }
          .aptr-stepper-horizontal > div:nth-child(2) {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
          }
          .aptr-stepper-horizontal > div:nth-child(2) > div {
            display: flex !important;
            align-items: center;
            text-align: left !important;
            gap: 10px;
          }
          .aptr-stepper-horizontal > div:nth-child(2) > div > div:first-child {
            margin: 0 !important;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
}
