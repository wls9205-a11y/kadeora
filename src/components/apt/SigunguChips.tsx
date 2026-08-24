// v4-C8 — 시·도 아래 시군구 칩 줄.
//
// 실제 물량이 있는 시군구만 낸다 (목록에 있는 카드에서 뽑으므로 구조적으로 보장된다).
// 정렬은 C3 과 같이 가나다 고정 — 건수 순으로 두면 칩 순서가 매일 바뀐다.

import Link from 'next/link';

const CHIP: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

export default function SigunguChips({
  region,
  items,
  current,
}: {
  region: string;
  items: { name: string; count: number }[];
  /** 선택된 시군구. 없으면 '전체'. */
  current: string;
}) {
  // 칩이 2개 미만이면 고를 것이 없다 — 자리만 먹는다.
  if (items.length < 2) return null;

  const base = `/apt?region=${encodeURIComponent(region)}`;
  const style = (active: boolean): React.CSSProperties =>
    active
      ? { ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#FFFFFF', fontWeight: 700 }
      : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        padding: '0 6px 10px',
      }}
    >
      <Link href={base} scroll={false} style={style(!current)}>전체</Link>
      {items.map((it) => (
        <Link
          key={it.name}
          href={`${base}&sgg=${encodeURIComponent(it.name)}`}
          scroll={false}
          style={style(current === it.name)}
          aria-current={current === it.name ? 'true' : undefined}
        >
          {it.name}
          <span style={{ fontSize: 'var(--fs-xs)', opacity: current === it.name ? 0.8 : 0.6 }}>{it.count}</span>
        </Link>
      ))}
    </div>
  );
}
