// H4-4 §5 — 기축 실거래 활동 목록.
//
// PipelineCard·SubscriptionCard 와 같은 `.kd-lrow` 3열을 쓴다. 목록 벌을 새로 만들지 않는다.
//   좌  180일 거래 건수      가운데  단지명 + 지역·최근 거래일      우  평형 고정 가격
//
// ⚠️ **가격 옆에 평형을 반드시 붙인다.** 평형 없는 가격은 단지 전체 평균과 구분되지 않고,
//    단지 평균은 평형 구성이 바뀌면 같이 움직여 시세로 읽을 수 없다 (lib 상단 실측).
//    그래서 평형·표본이 없으면 가격 자리를 «비운다» — 대신 채우지 않는다.
//
// ⚠️ 「시세」라고 쓰지 않는다. 가격이 붙는 건 실측 54%뿐이라, 시세표라고 부르면
//    나머지 46%가 결함처럼 보인다. 이 섹션이 주는 건 «거래가 있었다» 는 사실이다.

import Link from 'next/link';
import {
  areaLabel,
  dealDateLabel,
  eok,
  hasQuotablePrice,
  type GichukRow,
} from '@/lib/apt/gichuk-activity';

export default function GichukActivity({ items }: { items: GichukRow[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="kd-lhead" aria-hidden="true">
        <span>거래</span>
        <span>단지</span>
        <span>최다 평형가</span>
      </div>

      {items.map((r) => {
        const where = [r.region, r.sigungu].filter(Boolean).join(' ');
        const last = dealDateLabel(r.lastDealDate);
        const priced = hasQuotablePrice(r);

        return (
          <Link
            key={r.slug}
            href={`/apt/${encodeURIComponent(r.slug)}`}
            className="kd-lrow"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {/* 좌 — 이 섹션의 «주» 신호. 가격이 아니라 거래가 있었다는 사실이다. */}
            <span className="kd-lrow-k">{r.deals.toLocaleString('ko-KR')}건</span>

            <span style={{ minWidth: 0 }}>
              <span className="kd-lrow-t">{r.name}</span>
              <span className="kd-lrow-m">
                <span>{where}</span>
                {last && <span className="kd-lrow-m-fix">최근 {last}</span>}
              </span>
            </span>

            {/* 우 — 평형을 고정했을 때만 낸다.
                ⚠️ 아래 평형 라벨을 «떼지 말 것». 떼는 순간 단지 전체 평균으로 읽힌다. */}
            <span className="kd-lrow-r">
              {priced ? (
                <>
                  {eok(r.priceAvg)}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      lineHeight: 1.3,
                    }}
                  >
                    {areaLabel(r.areaM2)} {r.areaDeals}건
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                  평형 표본 부족
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
