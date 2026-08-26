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
    danger: { bg: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', border: 'rgba(239,68,68,0.2)' },
    warning: { bg: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: 'rgba(245,158,11,0.2)' },
    safe: { bg: 'rgba(34,197,94,0.1)', color: 'var(--accent-green)', border: 'rgba(34,197,94,0.2)' },
    info: { bg: 'rgba(59,130,246,0.1)', color: 'var(--brand)', border: 'rgba(59,130,246,0.2)' },
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
              fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 500,
              background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            }}>
              {item.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>
              {item.value}
            </span>
          </div>
        );
      })}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 600,
              background: tag.active ? 'rgba(139,92,246,0.1)' : 'var(--bg-hover)',
              // ⚠️ #8B5CF6 은 흰 배경 대비 4.23 으로 하한에 못 미쳤다. 같은 보라 계열
              //    기존 토큰 --accent-purple(#7C3AED)로 5.70. 새 토큰은 만들지 않았다.
              color: tag.active ? 'var(--accent-purple)' : 'var(--text-tertiary)',
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
