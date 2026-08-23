// v3 커밋5 — /stock 목록 행. .kd-lrow 3열 그리드.
//
// 행에서 시장명(KOSPI/KOSDAQ)과 종목코드를 뺐다 — 30행 전부에 같은 두 값이 반복되면서
// 정작 종목별로 다른 정보(이슈 근거)가 들어갈 폭을 먹고 있었다.
// 그 폭은 가운데 메타 한 줄(이슈 근거 칩)에 몰아준다.
//
// 좌측 칩: 이슈 탭은 점수, 그 외 탭은 순위. 점수 80 이상은 is-hot(--accent-red-bg).
//
// ⚠️ StockIssueCard(홈에서도 쓰는 카드)를 고치지 않고 /stock 전용 행을 새로 뒀다.
//    같은 컴포넌트를 바꾸면 홈 화면까지 같이 바뀐다 — 이번 범위 밖이다.

import Link from 'next/link';
import { getStockTone, stockChipStyle, formatChangePct } from '@/lib/stockColor';
import { scoreToDisplay } from '@/lib/issue/calc';
import IssueReasonChips from '@/components/issue/IssueReasonChips';
import WarningLabel from '@/components/issue/WarningLabel';
import type { IssueReason, IssueWarning } from '@/lib/issue/types';

/** 점수 80 이상은 붉은 칩으로 올린다. 그 아래는 단계 없이 기본 톤. */
const HOT_SCORE = 80;

export type StockListRowProps = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  /** 이슈 탭 — 좌측 칩이 점수가 된다. */
  score?: number | null;
  /** 그 외 탭 — 좌측 칩이 순위가 된다. */
  rank?: number;
  reasons?: IssueReason[] | null;
  warning?: IssueWarning | null;
  /** 이슈 근거가 없는 탭의 대체 메타 (섹터 등). 시장명·종목코드는 넣지 않는다. */
  meta?: string | null;
};

export default function StockListRow({
  symbol, name, price, changePct, score, rank, reasons, warning, meta,
}: StockListRowProps) {
  const tone = getStockTone(changePct);
  const chip = stockChipStyle(tone);
  const isIssue = score != null;
  const display = isIssue ? scoreToDisplay(score) : 0;
  const hot = isIssue && display >= HOT_SCORE;

  return (
    <Link href={`/stock/${symbol}`} className="kd-lrow" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className={hot ? 'kd-lrow-k is-hot' : 'kd-lrow-k'}>
        {isIssue ? display : rank ?? ''}
      </span>

      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t">{name}</span>
        <span className="kd-lrow-m">
          {reasons && reasons.length > 0 ? (
            <span className="kd-lrow-m-fix"><IssueReasonChips reasons={reasons} max={4} /></span>
          ) : meta ? (
            <span>{meta}</span>
          ) : null}
          {warning ? <span className="kd-lrow-m-fix"><WarningLabel warning={warning} /></span> : null}
        </span>
      </span>

      <span className="kd-lrow-r">
        {price != null ? Number(price).toLocaleString() : '-'}
        <span
          style={{
            display: 'block', marginTop: 1, fontSize: 10.5, fontWeight: 700,
            color: chip.color,
          }}
        >
          {formatChangePct(changePct)}
        </span>
      </span>
    </Link>
  );
}
