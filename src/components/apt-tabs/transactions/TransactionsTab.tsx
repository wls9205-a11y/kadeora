/**
 * TransactionsTab
 *
 * 실거래 탭 전체 조립. headline + price chart + 신고가 가로 카드 + 거래 테이블.
 */

import { PriceChart } from './PriceChart';
import { HighPriceCarousel } from './HighPriceCarousel';
import { DataTable } from '../shared/DataTable';
import { formatKrwShort, formatPercent, formatDateShort } from '../utils';
import type { TransactionItem, PriceChartPoint } from '../types';

type Props = {
  recentTransactions: TransactionItem[];
  highPriceItems: TransactionItem[];
  priceChartData: PriceChartPoint[];
};

export function TransactionsTab({
  recentTransactions,
  highPriceItems,
  priceChartData,
}: Props) {
  // 헤드라인: 12개월 변동률 기반
  const change =
    priceChartData.length >= 2
      ? ((priceChartData[priceChartData.length - 1].pricePerPyeong -
          priceChartData[0].pricePerPyeong) /
          priceChartData[0].pricePerPyeong) *
        100
      : 0;
  const latestPpy =
    priceChartData[priceChartData.length - 1]?.pricePerPyeong ?? 0;

  const headline =
    change > 0
      ? `12개월간 ${formatPercent(change)}, 평당 ${formatKrwShort(latestPpy)}까지`
      : `평당 ${formatKrwShort(latestPpy)}, 최근 12개월 보합세`;

  return (
    <>
      <section style={{ padding: '16px 18px 14px' }}>
        <div
          style={{
            fontSize: '10px',
            letterSpacing: '1.5px',
            color: 'var(--aptr-text-tertiary)',
            marginBottom: '6px',
          }}
        >
          실거래 추이
        </div>
        <h2
          className="aptr-headline aptr-prose"
          style={{
            fontSize: '20px',
            fontWeight: 500,
            color: 'var(--aptr-text-primary)',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {headline}
        </h2>
      </section>

      {/* 차트 */}
      <section style={{ padding: '0 18px 16px' }}>
        <PriceChart data={priceChartData} />
      </section>

      {/* 신고가 가로 카드 */}
      {highPriceItems.length > 0 ? (
        <section style={{ padding: '0 18px 16px' }}>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--aptr-text-tertiary)',
              letterSpacing: '0.3px',
              padding: '0 4px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span>이번 주 신고가 단지</span>
            <a
              href="/apt/transactions"
              className="aptr-link-reset"
              style={{ color: 'var(--aptr-brand)', fontSize: '11px' }}
            >
              전체 →
            </a>
          </div>
          <HighPriceCarousel items={highPriceItems} />
        </section>
      ) : null}

      {/* 최근 거래 테이블 */}
      <section style={{ padding: '0 18px 18px' }}>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--aptr-text-tertiary)',
            letterSpacing: '0.3px',
            padding: '0 4px 8px',
          }}
        >
          최근 거래
        </div>
        <DataTable
          columns={[
            { key: 'date', label: '날짜', width: '60px', mono: true },
            { key: 'name', label: '단지', width: '1fr' },
            { key: 'area', label: '㎡', width: '50px', align: 'center', mono: true },
            { key: 'floor', label: '층', width: '50px', align: 'center', mono: true },
            { key: 'price', label: '거래가', width: '80px', align: 'right', mono: true },
            { key: 'change', label: '변동', width: '70px', align: 'right', mono: true },
          ]}
          rows={recentTransactions.map((t) => ({
            id: t.id,
            href: t.href,
            cells: {
              date: { text: formatDateShort(t.date) },
              name: {
                text: t.site.name,
                bold: true,
                badge: t.isRecordHigh
                  ? { kind: 'green', label: '신고가' }
                  : undefined,
              },
              area: { text: `${t.areaSqm}` },
              floor: { text: t.floor ? `${t.floor}F` : '-' },
              price: { text: formatKrwShort(t.price), bold: true },
              change: t.changePct
                ? {
                    text: formatPercent(t.changePct),
                    tone: t.changePct >= 0 ? 'positive' : 'negative',
                  }
                : { text: '-' },
            },
          }))}
          emptyMessage="최근 거래가 없습니다"
        />
      </section>
    </>
  );
}
