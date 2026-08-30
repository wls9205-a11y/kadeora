// v7-C1 — /stock 2축 필터 UI.
//
// 시장(sticky 1줄) / 정렬 / 테마(선택) 세 줄. 두 축이 곱해지면서
// "코스닥에서 급등한 종목" 같은 조합이 가능해진다 — 단일 탭 5개로는 못 하던 것이다.
//
// 정렬 칩은 4개지만 '등락' 하나가 급등↔급락을 오간다. 칩을 4개로 유지하면서
// 급락을 잃지 않으려면 이 방법뿐이다 (파라미터를 더 만들면 URL 3개 고정이 깨진다).
//
// V5-V1 에서 지운 좌측 사이드바의 KOSPI·KOSDAQ·NYSE 링크가 여기로 흡수됐다.

import Link from 'next/link';
import {
  MARKETS, SORT_CHIPS, stockHref, changeToggleSort, changeChipLabel, isChangeSort,
  type StockParams,
} from '@/lib/stock/filters';

const CHIP: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-2xs)',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const chipStyle = (active: boolean): React.CSSProperties =>
  active
    ? { ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: 'var(--text-inverse)', fontWeight: 500 }
    : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

const ROW: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  padding: '0 6px 8px',
};

export default function StockFilterBars({
  params,
  themes,
}: {
  params: StockParams;
  /** stock_themes 최신 날짜 기준. 없으면 테마 줄을 내지 않는다. */
  themes: string[];
}) {
  return (
    <>
      {/* 시장 — sticky. 「헤더 바로 아래」를 크롬 스택에서 받는다. z-index 는 헤더(100) 미만.
          ⚠️ 결함 2호 — /stock 은 띠가 «있는» 라우트다. 45 를 박아 두면 헤더(52..97) 밑에 깔린다. */}
      <div
        role="group"
        aria-label="시장 선택"
        style={{
          ...ROW,
          position: 'sticky',
          top: 'var(--kd-header-bottom)',
          zIndex: 60,
          background: 'var(--bg-base)',
          paddingTop: 6,
        }}
      >
        {MARKETS.map((m) => (
          <Link
            key={m.key}
            href={stockHref(params, { market: m.key })}
            scroll={false}
            style={chipStyle(params.market === m.key)}
            aria-current={params.market === m.key ? 'true' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* 정렬 */}
      <div role="group" aria-label="정렬" style={ROW}>
        {SORT_CHIPS.map((c) => {
          if (c.key === 'change') {
            const active = isChangeSort(params.sort);
            return (
              <Link
                key="change"
                href={stockHref(params, { sort: changeToggleSort(params.sort) })}
                scroll={false}
                style={chipStyle(active)}
                aria-current={active ? 'true' : undefined}
              >
                {changeChipLabel(params.sort)}
              </Link>
            );
          }
          const active = params.sort === c.key;
          return (
            <Link
              key={c.key}
              href={stockHref(params, { sort: c.key })}
              scroll={false}
              style={chipStyle(active)}
              aria-current={active ? 'true' : undefined}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* 테마 — 선택. 데이터가 없는 날은 줄 자체를 내지 않는다. */}
      {themes.length > 0 && (
        <div role="group" aria-label="테마" style={ROW}>
          <Link href={stockHref(params, { theme: '' })} scroll={false} style={chipStyle(!params.theme)}>
            전체
          </Link>
          {themes.map((t) => (
            <Link
              key={t}
              href={stockHref(params, { theme: t })}
              scroll={false}
              style={chipStyle(params.theme === t)}
              aria-current={params.theme === t ? 'true' : undefined}
            >
              #{t}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
