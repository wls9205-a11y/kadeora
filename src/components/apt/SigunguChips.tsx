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
  hrefFor,
}: {
  region: string;
  items: { name: string; count: number }[];
  /** 선택된 시군구. 없으면 '전체'. */
  current: string;
  /**
   * H5-3 — 링크만 갈아 끼운다. 기본은 /apt.
   * ⚠️ 블로그용으로 «같은 모양의 컴포넌트를 하나 더 만들지 않는다». 두 벌이 되면
   *    선택 표시·간격·스크롤 동작이 조용히 갈린다. 다른 건 주소뿐이다.
   */
  hrefFor?: (sigungu: string | null) => string;
}) {
  // 칩이 2개 미만이면 고를 것이 없다 — 자리만 먹는다.
  if (items.length < 2) return null;

  const base = `/apt?region=${encodeURIComponent(region)}`;
  const link = (s: string | null) =>
    hrefFor ? hrefFor(s) : (s ? `${base}&sgg=${encodeURIComponent(s)}` : base);
  const style = (active: boolean): React.CSSProperties =>
    active
      // ⚠️ 선택색을 인라인으로 주지 않는다. 인라인 스타일은 «모든 레이어를 이기므로»
      //    screens.css 의 네이비 규칙이 먹지 않는다. 클래스에 맡긴다.
      ? { ...CHIP, fontWeight: 500 }
      : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

  return (
    <div
      className="apt-pill-scroll"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        padding: '0 6px 10px',
      }}
    >
      <Link href={link(null)} scroll={false} style={style(!current)} aria-current={!current ? 'true' : undefined}>전체</Link>
      {items.map((it) => (
        <Link
          key={it.name}
          href={link(it.name)}
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
