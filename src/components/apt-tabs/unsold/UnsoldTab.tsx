/**
 * UnsoldTab
 *
 * 미분양 탭 전체 조립. headline + 추이 차트 + 단지 hero + 혜택 카드 + 컴팩트 리스트.
 */

import { HeroCard } from '../shared/HeroCard';
import { CompactRow } from '../shared/CompactRow';
import { TrendChart } from './TrendChart';
import { DiscountCard } from './DiscountCard';
import { formatKrwShort } from '../utils';
import type { UnsoldItem, UnsoldTrendPoint } from '../types';

type Props = {
  items: UnsoldItem[];
  trendData: UnsoldTrendPoint[];
};

export function UnsoldTab({ items, trendData }: Props) {
  if (items.length === 0) {
    return (
      <>
        <section style={{ padding: '16px 18px 14px' }}>
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
            미분양이 모두 해소되었습니다
          </h2>
        </section>
        <section style={{ padding: '0 18px 18px' }}>
          <TrendChart data={trendData} />
        </section>
      </>
    );
  }

  const featured = items[0];
  const rest = items.slice(1);

  const headline =
    items.length === 1
      ? `${featured.site.name} ${featured.remainingUnits}세대 잔여, ${featured.discountPct}% 할인`
      : `미분양 ${items.length}건, 최대 할인 ${Math.max(...items.map((i) => i.discountPct))}%`;

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
          미분양 잔여
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

      {/* 추이 차트 */}
      <section style={{ padding: '0 18px 16px' }}>
        <TrendChart data={trendData} />
      </section>

      {/* hero + 할인 카드 */}
      <section className="aptr-grid-asymmetric" style={{ marginBottom: '16px' }}>
        <HeroCard
          site={featured.site}
          badge={{ kind: 'red', label: `잔여 ${featured.remainingUnits}세대` }}
          topRightLabel="조감도"
          subtitle={`전용 ${featured.unitSizes} · 즉시 입주 가능`}
          stats={[
            { label: '분양가', value: formatKrwShort(featured.originalPrice) },
            { label: '현재가', value: formatKrwShort(featured.currentPrice) },
            {
              label: '할인',
              value: `-${featured.discountPct}%`,
              tone: 'negative',
            },
          ]}
          imageHeight={140}
          href={featured.href}
          priority
        />

        <DiscountCard item={featured} />
      </section>

      {/* 다른 단지 */}
      {rest.length > 0 ? (
        <section style={{ padding: '0 18px 18px' }}>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--aptr-text-tertiary)',
              letterSpacing: '0.3px',
              padding: '0 4px 6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span>다른 미분양 단지</span>
            <a
              href="/apt/unsold"
              className="aptr-link-reset"
              style={{ color: 'var(--aptr-brand)', fontSize: '11px' }}
            >
              전체 →
            </a>
          </div>
          <div
            style={{
              background: 'var(--aptr-bg-card)',
              border: '0.5px solid var(--aptr-border-subtle)',
              borderRadius: 'var(--aptr-radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--aptr-shadow-card)',
            }}
          >
            {rest.map((item, idx) => (
              <CompactRow
                key={item.id}
                href={item.href}
                badge={{ kind: 'red', label: `${item.remainingUnits}세대` }}
                title={item.site.name}
                meta={`전용 ${item.unitSizes}`}
                primaryValue={formatKrwShort(item.currentPrice)}
                secondaryValue={`-${item.discountPct}%`}
                secondaryValueTone="negative"
                isFirst={idx === 0}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
