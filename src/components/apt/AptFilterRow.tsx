'use client';
// ONESHOT §I-2 — /apt 필터 한 줄.
//
// 이전에는 세로를 세 덩이가 먹었다.
//   ① `지역 · 접수중 N건 · 전체 17개 →` 헤더 줄
//   ② 46px 높이 지역 칩이 가로 스크롤되는 줄
//   ③ `전체 30 / 접수중 8 / 임박 D-7 22` 상태 칩 줄
// 첫 화면에서 정작 봐야 할 청약 타임라인이 접혀 내려갔다.
//
// 지금은 한 줄이다. 상태 칩을 왼쪽에 먼저 두고 — 4개뿐이라 항상 보인다 —
// 구분선 뒤로 지역 칩이 스크롤된다. 지역이 18개라 지역을 앞에 두면
// 상태 칩이 화면 밖으로 밀려 눌리지 않는다.
//
// 선택된 칩만 채운다. 나머지는 테두리 없이 글자만 — 모든 칩이 테두리를
// 가지면 무엇이 선택됐는지가 안 읽힌다.
//
// ⚠️ 라우트·쿼리 규칙은 그대로다. 바뀐 건 모양과 자리뿐이다.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { setStoredRegion, KR_REGIONS_17 } from '@/lib/region-storage';

export type AptStatusKey = 'open' | 'soon' | 'leftover';

export interface RegionCount {
  region: string;
  live: number;
  recent: number;
}

const CHIP: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--sp-xs)',
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
  color: 'var(--text-secondary)',
  background: 'transparent',
};

const ACTIVE: React.CSSProperties = {
  ...CHIP,
  background: 'var(--brand)',
  borderColor: 'var(--brand)',
  color: 'var(--text-inverse)',
  fontWeight: 500,
};

/** 건수는 칩 크기를 키우지 않게 작게, 위첨자처럼 붙인다. */
function Count({ n, active }: { n: number; active: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      aria-hidden
      style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 500,
        opacity: active ? 1 : 0.75,   // ⚠️ 활성 0.85 는 흰글씨/--brand 합성 대비 4.19 로 하한 미달이었다(비활성 0.75 는 4.88 통과).
        //    건수의 종속감은 이미 fs-xs(칩 본문 fs-sm)가 낸다. 1 로 올려 5.17.
        color: active ? 'var(--text-inverse)' : 'var(--accent-red)',
      }}
    >
      {n}
    </span>
  );
}

export default function AptFilterRow({
  regions,
  currentRegion,
  counts,
  total,
  currentStatus,
  baseQuery,
}: {
  regions: RegionCount[];
  currentRegion: string;
  counts: Record<AptStatusKey, number>;
  total: number;
  currentStatus: string;
  /** region·sgg 를 유지한 쿼리 문자열 (앞에 '?' 없음, 비어 있을 수 있음). */
  baseQuery: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeChip = useRef<HTMLAnchorElement>(null);

  // 지역 18개가 한 줄에 다 안 들어간다. 고른 지역이 화면 밖에 있으면
  // 무엇을 보고 있는지 알 수 없어 마운트 때 그 칩을 시야로 끌어온다.
  // ⚠️ 페이지 전체가 아니라 이 줄만 움직인다 — block:'nearest'.
  useEffect(() => {
    const el = activeChip.current;
    const box = scroller.current;
    if (!el || !box) return;
    if (el.offsetLeft + el.offsetWidth <= box.clientWidth) return; // 이미 보인다
    el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [currentRegion]);

  // 공고 이력이 아예 없는 시·도도 칩은 나온다 — 0 으로 채운다.
  const byName = new Map(regions.map((r) => [r.region, r]));
  const full: RegionCount[] = KR_REGIONS_17.map(
    (name) => byName.get(name) ?? { region: name, live: 0, recent: 0 },
  );
  // v4-C3 정렬 유지: [접수중 1건 이상 · 가나다] → [나머지 · 가나다].
  // 건수 순으로 매일 순서가 바뀌면 위치 기억이 성립하지 않는다.
  full.sort((a, b) => {
    const aLive = a.live > 0 ? 0 : 1;
    const bLive = b.live > 0 ? 0 : 1;
    return aLive - bLive || a.region.localeCompare(b.region, 'ko');
  });
  const liveTotal = full.reduce((s, r) => s + r.live, 0);

  const stHref = (key: string) => {
    const parts = [baseQuery, key ? `st=${key}` : ''].filter(Boolean);
    return parts.length > 0 ? `/apt?${parts.join('&')}` : '/apt';
  };
  const statusItems: { key: AptStatusKey; label: string }[] = [
    { key: 'open', label: '접수중' },
    { key: 'soon', label: '임박' },
    { key: 'leftover', label: '무순위' },
  ];
  const shownStatus = statusItems.filter((i) => counts[i.key] > 0);

  return (
    <div
      ref={scroller}
      role="group"
      aria-label="지역 · 청약 상태 필터"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-xs)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        padding: '0 6px 8px',
        margin: '0 0 6px',
      }}
    >
      <Link href={stHref('')} scroll={false} style={currentStatus ? CHIP : ACTIVE}>
        전체
        <Count n={total} active={!currentStatus} />
      </Link>
      {shownStatus.map((i) => {
        const active = currentStatus === i.key;
        return (
          <Link
            key={i.key}
            href={stHref(i.key)}
            scroll={false}
            style={active ? ACTIVE : CHIP}
            aria-current={active ? 'true' : undefined}
          >
            {i.label}
            <Count n={counts[i.key]} active={active} />
          </Link>
        );
      })}

      <span
        aria-hidden
        style={{ flex: '0 0 auto', width: 1, height: 16, margin: '0 5px', background: 'var(--border)' }}
      />

      <RegionChip name="전국" count={liveTotal} active={currentRegion === '전국'} chipRef={activeChip} />
      {full.map((r) => (
        <RegionChip
          key={r.region}
          name={r.region}
          count={r.live}
          active={currentRegion === r.region}
          dim={r.live === 0}
          chipRef={activeChip}
        />
      ))}

      {/* 헤더 줄에 있던 링크. 줄을 하나 없애면서 칩 끝으로 옮겼다 — 라우트는 그대로. */}
      <Link
        href={currentRegion === '전국' ? '/apt/region' : `/apt/region?region=${encodeURIComponent(currentRegion)}`}
        style={{ ...CHIP, color: 'var(--text-tertiary)', fontWeight: 500 }}
      >
        전체 17개 →
      </Link>
    </div>
  );
}

function RegionChip({
  name,
  count,
  active,
  dim = false,
  chipRef,
}: {
  name: string;
  count: number;
  active: boolean;
  dim?: boolean;
  chipRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  const href = name === '전국' ? '/apt' : `/apt?region=${encodeURIComponent(name)}`;
  return (
    <Link
      ref={active ? chipRef : undefined}
      href={href}
      onClick={() => setStoredRegion(name)}
      aria-current={active ? 'true' : undefined}
      aria-label={count > 0 ? `${name} 접수중 ${count}건` : `${name} 접수중인 청약 없음`}
      scroll={false}
      style={
        active
          ? { ...ACTIVE, background: 'var(--text-primary)', borderColor: 'var(--text-primary)', color: 'var(--bg-base)' }
          : { ...CHIP, color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)' }
      }
    >
      {name}
      <Count n={count} active={active} />
    </Link>
  );
}
