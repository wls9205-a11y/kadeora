import React from 'react';

const STAGES_DESKTOP = [
  { key: 'site_planning', label: '사전계획' },
  { key: 'pre_announcement', label: '분양예고' },
  { key: 'model_house_open', label: '모델하우스' },
  { key: 'subscription_open', label: '청약' },
  { key: 'special_supply', label: '발표' },
  { key: 'contract', label: '계약' },
  { key: 'move_in', label: '입주' },
];

const STAGES_MOBILE = [
  { key: 'pre_announcement', label: '예고' },
  { key: 'model_house_open', label: '모델' },
  { key: 'subscription_open', label: '청약' },
  { key: 'move_in', label: '입주' },
];

interface Props {
  current?: string | null;
}

function makeIndex(stages: { key: string }[], current: string | null): number {
  if (!current) return 0;
  const i = stages.findIndex(s => s.key === current);
  if (i >= 0) return i;
  // 합리적 매핑 — current가 desktop 단계면 mobile에서 가장 가까운 단계 찾기
  const order = ['site_planning', 'pre_announcement', 'model_house_open', 'special_supply', 'subscription_open', 'contract', 'construction', 'pre_move_in', 'move_in', 'resale'];
  const cIdx = order.indexOf(current);
  if (cIdx < 0) return 0;
  let best = 0;
  for (let j = 0; j < stages.length; j++) {
    const sIdx = order.indexOf(stages[j].key);
    if (sIdx <= cIdx) best = j;
  }
  return best;
}

function nextStageHint(current: string | null): string | null {
  const map: Record<string, string> = {
    site_planning: '분양예고',
    pre_announcement: '모델하우스 오픈',
    model_house_open: '청약 D-30',
    special_supply: '청약 진행',
    subscription_open: '당첨자 발표',
    contract: '계약 마감',
    construction: '입주 준비',
    pre_move_in: '입주',
  };
  return current ? map[current] || null : null;
}

export default function LifecycleTimeline({ current }: Props) {
  const dIdx = makeIndex(STAGES_DESKTOP, current ?? null);
  const mIdx = makeIndex(STAGES_MOBILE, current ?? null);
  const nextHint = nextStageHint(current ?? null);

  function renderStages(stages: typeof STAGES_DESKTOP, activeIdx: number) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, position: 'relative', padding: '14px 4px 6px' }}>
        {stages.map((s, i) => {
          const isCurrent = i === activeIdx;
          const isPast = i < activeIdx;
          const dotSize = isCurrent ? 12 : 8;
          const dotColor = isCurrent ? 'var(--kd-accent)' : isPast ? 'var(--text-primary)' : 'var(--text-tertiary)';
          return (
            <div key={s.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
              {/* connector line behind */}
              {i > 0 && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: dotSize === 12 ? 6 : 8,
                    right: '50%',
                    width: '100%',
                    height: 1,
                    background: i <= activeIdx ? 'var(--text-primary)' : 'var(--border)',
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: dotColor,
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: isCurrent ? '0 0 0 4px rgba(250,199,117,0.25)' : 'none',
                }}
              />
              <span style={{ fontSize: 11, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--kd-accent)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section
      aria-label="단지 진행 단계"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', margin: '0 0 12px', position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5 }}>단지 진행 단계</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)', padding: '2px 8px', borderRadius: 999, background: 'var(--kd-accent-soft)', border: '1px solid var(--kd-accent-border)', letterSpacing: 0.5 }}>
          CARDERA ONLY
        </span>
      </div>

      <div className="lf-desktop">{renderStages(STAGES_DESKTOP, dIdx)}</div>
      <div className="lf-mobile">{renderStages(STAGES_MOBILE, mIdx)}</div>

      {nextHint && (
        <div style={{ marginTop: 'var(--kd-gap-md)', padding: '10px 12px', background: 'var(--kd-accent-soft)', border: '1px solid var(--kd-accent-border)', borderRadius: 'var(--kd-radius-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--kd-gap-sm)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, lineHeight: 1.5 }}>
            다음 단계: <span style={{ color: 'var(--kd-accent)', fontWeight: 800 }}>{nextHint}</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--kd-accent)', fontWeight: 800, whiteSpace: 'nowrap' }}>알림 받기 →</span>
        </div>
      )}

      <style>{`
        .lf-mobile { display: none; }
        @media (max-width: 480px) {
          .lf-desktop { display: none; }
          .lf-mobile { display: block; }
        }
      `}</style>
    </section>
  );
}
