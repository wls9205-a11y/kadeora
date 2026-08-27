/**
 * H5-2 2단 — 단계 요약 한 줄.
 *
 *   6 분양예정 · 4 분양중 · 3 선착순 · 12 재개발
 *
 * ── 왜 AptFilterRow 를 대체하는가 ────────────────────────────────────────────
 * AptFilterRow 는 「필터 버튼 줄」이었다. 사용자는 «지금 이 지역에 뭐가 얼마나
 * 있는지» 를 먼저 알고 싶어 하고, 필터는 그 다음이다. 숫자를 앞에 두면
 * 한 줄이 «요약» 이면서 동시에 «필터» 가 된다.
 *
 * ⚠️ AptFilterRow 파일은 지우지 않는다. import 만 뺀다 —
 *    되돌릴 판단이 남아 있고, 지우면 그 판단 근거가 같이 사라진다.
 *
 * ⚠️ 0인 항목은 렌더하지 않는다. 「0 분양중」은 정보가 아니라 잡음이고,
 *    누르면 빈 목록으로 데려간다.
 *
 * 숫자 600 / 라벨 400 — TY1 사다리. 700 은 가격·경쟁률 같은 «희소한» 수치 전용이다.
 */

import Link from 'next/link';
import type { AptStatusKey } from './AptFilterRow';

export interface StageItem {
  /** AptFilterRow 와 «같은» 키를 쓴다. 두 벌이 되면 링크와 필터가 갈린다. */
  key: AptStatusKey | 'redev';
  label: string;
  count: number;
}

export default function StageSummaryStrip({
  items,
  current,
  baseQuery,
}: {
  items: StageItem[];
  current?: string;
  /** region·sgg 선택을 잃지 않도록 물려받는 쿼리 */
  baseQuery?: string;
}) {
  const shown = items.filter((i) => i.count > 0);
  if (shown.length === 0) return null;

  const href = (key: string) => {
    const qs = [baseQuery, `st=${encodeURIComponent(key)}`].filter(Boolean).join('&');
    return `/apt?${qs}`;
  };

  return (
    <nav className="stage-strip" aria-label="단계별 현장 수">
      {shown.map((it, i) => {
        const on = current === it.key;
        return (
          <span key={it.key} className="stage-strip__cell">
            {i > 0 && <span className="stage-strip__sep" aria-hidden="true">·</span>}
            <Link
              href={href(it.key)}
              scroll={false}
              className="stage-strip__link"
              data-active={on ? 'true' : undefined}
              aria-current={on ? 'true' : undefined}
            >
              <span className="stage-strip__n">{it.count.toLocaleString()}</span>
              <span className="stage-strip__l">{it.label}</span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
