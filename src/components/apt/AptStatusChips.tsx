// v5-V1 — /apt 상태 필터 칩.
//
// 좌측 Sidebar 의 '부동산 분류' 6개를 흡수한 자리다.
//   분양 진행 → 접수중 / 분양 임박 D-7 → 임박 / 미분양·줍줍 → 무순위
//   재건축·재개발 · 실거래·시세 → 전용 라우트가 있어 AptToolChips 로 갔다
//   모델하우스 → 데이터가 없다. 없는 필터를 만들지 않는다.
//
// 필터는 이미 받은 hub.cards 에서 건다 — 조회가 늘지 않고, 건수가 0인 칩은
// 아예 렌더되지 않아 '눌러도 아무것도 없는' 칩이 생기지 않는다.
// 정렬은 고정 순서다 (C3·C8 과 같은 원칙 — 건수에 따라 순서가 바뀌면 안 된다).

import Link from 'next/link';

export type AptStatusKey = 'open' | 'soon' | 'leftover';

const CHIP: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 11.5,
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

export default function AptStatusChips({
  counts,
  total,
  current,
  baseQuery,
}: {
  counts: Record<AptStatusKey, number>;
  total: number;
  current: string;
  /** region·sgg 를 유지한 쿼리 문자열 (앞에 '?' 없음, 비어 있을 수 있음). */
  baseQuery: string;
}) {
  const items: { key: AptStatusKey; label: string }[] = [
    { key: 'open', label: '접수중' },
    { key: 'soon', label: '임박 D-7' },
    { key: 'leftover', label: '무순위·줍줍' },
  ];
  const shown = items.filter((i) => counts[i.key] > 0);
  if (shown.length === 0) return null;

  const href = (key: string) => {
    const parts = [baseQuery, key ? `st=${key}` : ''].filter(Boolean);
    return parts.length > 0 ? `/apt?${parts.join('&')}` : '/apt';
  };
  const style = (active: boolean): React.CSSProperties =>
    active
      ? { ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#FFFFFF', fontWeight: 700 }
      : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

  return (
    <div
      role="group"
      aria-label="청약 상태 필터"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        padding: '0 6px 10px',
      }}
    >
      <Link href={href('')} scroll={false} style={style(!current)}>
        전체
        <span style={{ fontSize: 10, opacity: current ? 0.6 : 0.8 }}>{total}</span>
      </Link>
      {shown.map((i) => (
        <Link
          key={i.key}
          href={href(i.key)}
          scroll={false}
          style={style(current === i.key)}
          aria-current={current === i.key ? 'true' : undefined}
        >
          {i.label}
          <span style={{ fontSize: 10, opacity: current === i.key ? 0.8 : 0.6 }}>{counts[i.key]}</span>
        </Link>
      ))}
    </div>
  );
}
