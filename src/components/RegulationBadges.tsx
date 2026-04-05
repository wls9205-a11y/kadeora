'use client';

interface Props {
  transferLimitYears?: number | null;
  residenceYears?: number | null;
  rewinLimitYears?: number | null;
  isSpeculativeZone?: boolean | null;
  isRegulatedArea?: boolean | null;
  isPriceLimit?: boolean | null;
  loanRate?: string | null;
  // 해제 예정일 계산용
  contractDate?: string | null; // cntrct_cncls_bgnde
}

type Level = 'danger' | 'warning' | 'safe' | 'info';

function getBadgeStyle(level: Level) {
  const map = {
    danger: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'rgba(239,68,68,0.2)' },
    warning: { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: 'rgba(245,158,11,0.2)' },
    safe: { bg: 'rgba(34,197,94,0.1)', color: '#22C55E', border: 'rgba(34,197,94,0.2)' },
    info: { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: 'rgba(59,130,246,0.2)' },
  };
  return map[level];
}

function calcReleaseDate(contractDate: string | null | undefined, years: number): string | null {
  if (!contractDate) return null;
  try {
    const d = new Date(contractDate);
    d.setFullYear(d.getFullYear() + years);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch { return null; }
}

export default function RegulationBadges(props: Props) {
  const items: { label: string; value: string; level: Level }[] = [];

  // 전매제한
  if (props.transferLimitYears != null && props.transferLimitYears > 0) {
    const release = calcReleaseDate(props.contractDate, props.transferLimitYears);
    const level: Level = props.transferLimitYears >= 5 ? 'danger' : props.transferLimitYears >= 3 ? 'warning' : 'safe';
    items.push({
      label: '전매제한',
      value: `${props.transferLimitYears}년${release ? ` (해제: ${release})` : ''}`,
      level,
    });
  }

  // 거주의무
  if (props.residenceYears != null && props.residenceYears > 0) {
    const level: Level = props.residenceYears >= 3 ? 'warning' : 'safe';
    items.push({ label: '거주의무', value: `${props.residenceYears}년`, level });
  }

  // 재당첨
  if (props.rewinLimitYears != null && props.rewinLimitYears > 0) {
    const level: Level = props.rewinLimitYears >= 7 ? 'danger' : 'warning';
    items.push({ label: '재당첨 제한', value: `${props.rewinLimitYears}년`, level });
  }

  // 중도금 대출
  if (props.loanRate) {
    const isInterestFree = props.loanRate.includes('무이자');
    items.push({
      label: '중도금 대출',
      value: props.loanRate,
      level: isInterestFree ? 'safe' : 'info',
    });
  }

  if (items.length === 0) return null;

  const tags: { label: string; active: boolean }[] = [];
  if (props.isPriceLimit != null) tags.push({ label: '분양가상한제', active: !!props.isPriceLimit });
  if (props.isSpeculativeZone) tags.push({ label: '투기과열지구', active: true });
  if (props.isRegulatedArea) tags.push({ label: '조정대상지역', active: !!props.isRegulatedArea });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => {
        const s = getBadgeStyle(item.level);
        return (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
          }}>
            <span style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
              background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            }}>
              {item.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>
              {item.value}
            </span>
          </div>
        );
      })}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 600,
              background: tag.active ? 'rgba(139,92,246,0.1)' : 'var(--bg-hover)',
              color: tag.active ? '#8B5CF6' : 'var(--text-tertiary)',
              border: `1px solid ${tag.active ? 'rgba(139,92,246,0.2)' : 'var(--border)'}`,
            }}>
              {tag.active ? '✓ ' : ''}{tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
