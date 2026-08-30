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

// V4-2 — 두 축은 «문법이 달라야» 한다.
//   시장 = 1차 축(무엇을 보는가) → 언더라인 탭 .kd-utab
//   정렬·테마 = 2차 필터(어떻게 거르는가) → 칩 유지
// 셋 다 언더라인으로 만들면 v7-C1 이 세운 2축 구분이 사라진다. 시안의 /stock 도
// 언더라인 줄은 «하나» 뿐이다(국내/해외/관심/업종 = 시장 축).
const CHIP: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--sp-xs)',
  // 판정회신 증분2 B — 인터랙티브 타깃은 --touch-min 하한을 진다. 32 는 그 아래였다.
  minHeight: 'var(--touch-min)',
  padding: '0 var(--sp-md)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-2xs)',
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

/* V4-2b — 활성색을 «기존 네이비 표준» 에 넘긴다(판정회신 증분7 판정 1).
   screens.css 의 `.apt-pill-scroll a[aria-current='true']` 가 그 표준이고
   「H5 에서 선택은 전 화면 공통으로 네이비」가 그때의 판정이다. 여기만 --brand(파랑)로
   갈라져 있었다 — /blog 서브칩과 «같은 이탈» 이었다.
   ⛔ 활성 배경·글자색을 인라인으로 주지 않는다. 인라인은 모든 @layer 를 이겨
      그 규칙이 «안 먹는다». 색을 비워 클래스에 맡기는 것이 이 함수의 요점이다.
   ⚠️ 그래서 아래 두 줄(class + aria-current)이 «짝» 이다. 하나만 있으면 무색이 된다. */
const chipStyle = (active: boolean): React.CSSProperties =>
  active
    ? { ...CHIP, fontWeight: 600 }
    : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

const ROW: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--sp-sm)',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  padding: '0 var(--sp-sm) var(--sp-sm)',
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
        className="kd-utabs"
        style={{
          position: 'sticky',
          top: 'var(--kd-header-bottom)',
          zIndex: 60,
        }}
      >
        {MARKETS.map((m) => (
          <Link
            key={m.key}
            href={stockHref(params, { market: m.key })}
            scroll={false}
            className="kd-utab"
            aria-current={params.market === m.key ? 'true' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* 정렬 */}
      <div role="group" aria-label="정렬" className="apt-pill-scroll" style={ROW}>
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
        <div role="group" aria-label="테마" className="apt-pill-scroll" style={ROW}>
          {/* ⚠️ aria-current 가 «없었다». 표준 규칙이 그 속성으로 걸리므로,
              없으면 「전체」만 활성 표시가 안 되는 한 칸짜리 구멍이 된다. */}
          <Link
            href={stockHref(params, { theme: '' })}
            scroll={false}
            style={chipStyle(!params.theme)}
            aria-current={!params.theme ? 'true' : undefined}
          >
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
