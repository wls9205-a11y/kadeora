// v3 커밋5 — /stock 목록 행. .kd-lrow 3열 그리드.
//
// 행에서 시장명(KOSPI/KOSDAQ)과 종목코드를 뺐다 — 30행 전부에 같은 두 값이 반복되면서
// 정작 종목별로 다른 정보(이슈 근거)가 들어갈 폭을 먹고 있었다.
// 그 폭은 가운데 메타 한 줄(이슈 근거 칩)에 몰아준다.
//
// v4-C7-3: 좌측 64×40 자리는 스파크라인이 가져갔다. 종목 사진은 데이터가 0건이고
//    로고는 상표 문제가 있다 — 등락 색(--accent-red/--accent-blue)이 그대로 시각 신호가 된다.
//    점수·순위는 제목 줄 앞 배지로 옮겼다 (C7-1/C7-2 와 같은 이동).
//    ⚠️ 데이터가 없어도 같은 64×40 을 차지한다. 빈 칸을 허용하면 행 정렬이 무너진다.
//    점수 80 이상은 배지가 is-hot(--accent-red-bg).
//
// ⚠️ StockIssueCard(홈에서도 쓰는 카드)를 고치지 않고 /stock 전용 행을 새로 뒀다.
//    같은 컴포넌트를 바꾸면 홈 화면까지 같이 바뀐다 — 이번 범위 밖이다.

import Link from 'next/link';
import MiniSparkline from '@/components/MiniSparkline';
import { getStockTone, stockChipStyle, formatChangePct } from '@/lib/stockColor';
import { scoreToDisplay } from '@/lib/issue/calc';
import WarningLabel from '@/components/issue/WarningLabel';
import { REASON_LABELS, REASON_MIN_VALUE } from '@/lib/issue/labels';
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
  /**
   * 좌측 스파크라인용 종가 배열. 2점 미만이면 그리지 않는다.
   * 이슈 탭은 stock_issue_scores.sparkline_5d (5거래일, 실측 보유율 1229/1805),
   * 그 외 탭은 stock_price_history 최근 7거래일.
   */
  spark?: number[] | null;
};

export default function StockListRow({
  symbol, name, price, changePct, score, rank, reasons, warning, meta, spark,
}: StockListRowProps) {
  /* M4-1 행 정규화 — 최상위 사유 «하나» 만 텍스트로 쓴다.
     ⚠️ 값이 REASON_MIN_VALUE 미만이면 라벨을 달지 않는다 — 근거가 약한 말을 붙이지 않는다. */
  const topReasonLabel = (Array.isArray(reasons) ? reasons : [])
    .filter((r) => typeof r?.value === 'number' && r.value >= REASON_MIN_VALUE && REASON_LABELS[r.tag])
    .sort((a, b) => b.value - a.value)
    .map((r) => REASON_LABELS[r.tag])[0] ?? null;

  const tone = getStockTone(changePct);
  const chip = stockChipStyle(tone);
  const isIssue = score != null;
  const display = isIssue ? scoreToDisplay(score) : 0;
  const hot = isIssue && display >= HOT_SCORE;

  const points = Array.isArray(spark) ? spark.filter((v) => typeof v === 'number' && Number.isFinite(v)) : [];
  const hasSpark = points.length >= 2;
  const badge = isIssue ? String(display) : rank != null ? String(rank) : '';

  return (
    <Link href={`/stock/${symbol}`} className="kd-lrow kd-lrow--spark" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className="kd-lrow-spark" aria-hidden="true">
        {hasSpark ? (
          <MiniSparkline data={points} color={chip.color} width={64} height={40} />
        ) : (
          // 데이터 없음 — 같은 64×40 을 지키되 평평한 선으로 '값 없음' 을 말한다
          <span className="kd-lrow-spark-flat" />
        )}
      </span>

      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t">
          {badge && (
            <span className={hot ? 'kd-lrow-badge is-hot' : 'kd-lrow-badge'}>{badge}</span>
          )}
          {name}
        </span>
        <span className="kd-lrow-m">
          {/* M4-1 행 정규화 — 사유 칩 4개가 매 행에 반복되면 그건 정보가 아니라 배경이 된다.
              «최상위 사유 하나» 만 보조 메타에 인라인 텍스트로 붙인다(칩 아님).
              ⚠️ 값이 REASON_MIN_VALUE 미만이면 붙이지 않는다 — 근거가 약한 라벨을 달지 않는다. */}
          {topReasonLabel || meta ? (
            <span>{[meta, topReasonLabel].filter(Boolean).join(' · ')}</span>
          ) : null}
          {warning ? <span className="kd-lrow-m-fix"><WarningLabel warning={warning} /></span> : null}
        </span>
      </span>

      <span className="kd-lrow-r">
        {price != null ? Number(price).toLocaleString() : '-'}
        <span
          style={{
            display: 'block', marginTop: 1, fontSize: 'var(--fs-3xs)', fontWeight: 500,
            color: chip.color,
          }}
        >
          {formatChangePct(changePct)}
        </span>
      </span>
    </Link>
  );
}
