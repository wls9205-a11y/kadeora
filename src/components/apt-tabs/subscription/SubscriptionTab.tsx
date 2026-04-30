/**
 * SubscriptionTab
 *
 * 청약 탭 전체 조립. headline + hero + simulator + 일정 테이블.
 * 데스크톱: hero 좌측 + simulator 우측 그리드. 모바일: 1col stack.
 */

import { HeroCard } from '../shared/HeroCard';
import { DataTable } from '../shared/DataTable';
import { ScoreSimulator } from './ScoreSimulator';
import {
  formatKrwShort,
  dDayBadgeKind,
} from '../utils';
import type { SubscriptionItem } from '../types';

type Props = {
  items: SubscriptionItem[];
  myScore?: number;
};

export function SubscriptionTab({ items, myScore = 65 }: Props) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '40px 18px',
          textAlign: 'center',
          color: 'var(--aptr-text-secondary)',
          fontSize: '13px',
        }}
      >
        진행 중인 청약이 없습니다.
      </div>
    );
  }

  const featured = items[0];
  const rest = items.slice(1);

  const headline =
    featured.dDay <= 3
      ? `${featured.site.name} 청약 마감 D-${featured.dDay}, 평균 경쟁률 ${featured.expectedCompetition}:1`
      : `진행 중인 청약 ${items.length}건, 가장 가까운 마감은 D-${featured.dDay}`;

  return (
    <>
      {/* 헤드라인 */}
      <section style={{ padding: '16px 18px 14px' }}>
        <div
          style={{
            fontSize: '10px',
            letterSpacing: '1.5px',
            color: 'var(--aptr-text-tertiary)',
            marginBottom: '6px',
            wordBreak: 'keep-all',
          }}
        >
          청약 일정
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

      {/* hero + simulator */}
      <section className="aptr-grid-asymmetric" style={{ marginBottom: '16px' }}>
        <HeroCard
          site={featured.site}
          badge={{ kind: dDayBadgeKind(featured.dDay), label: `D-${featured.dDay} 마감 임박` }}
          topRightLabel="조감도"
          subtitle={`총 ${featured.unitCount}세대 · 전용 ${featured.unitSizes} · 평균 ${formatKrwShort(featured.avgPrice)}`}
          stats={[
            {
              label: '예상 1순위',
              value: `${featured.expectedCompetition}:1`,
              tone: 'accent',
            },
            featured.minScore
              ? { label: '최저 가점', value: `${featured.minScore}점` }
              : { label: '평형', value: featured.unitSizes },
            { label: '평형', value: featured.unitSizes },
          ]}
          imageHeight={140}
          href={featured.href}
          priority
        />

        <ScoreSimulator
          initialScore={myScore}
          targets={items
            .filter((i) => typeof i.minScore === 'number')
            .map((i) => ({ name: i.site.name, minScore: i.minScore! }))}
        />
      </section>

      {/* 일정 테이블 */}
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
            <span>다가오는 청약 일정</span>
            <a
              href="/apt/subscription"
              className="aptr-link-reset"
              style={{ color: 'var(--aptr-brand)', fontSize: '11px' }}
            >
              전체 →
            </a>
          </div>
          <DataTable
            columns={[
              { key: 'dday', label: 'D-day', width: '60px', align: 'center' },
              { key: 'name', label: '단지', width: '1fr' },
              { key: 'units', label: '세대', width: '60px', align: 'right', mono: true },
              { key: 'price', label: '분양가', width: '70px', align: 'right', mono: true },
              { key: 'competition', label: '예상', width: '60px', align: 'right', mono: true },
            ]}
            rows={rest.map((item) => ({
              id: item.id,
              href: item.href,
              cells: {
                dday: {
                  text: '',
                  badge: { kind: dDayBadgeKind(item.dDay), label: `D-${item.dDay}` },
                },
                name: { text: item.site.name, bold: true },
                units: { text: `${item.unitCount}` },
                price: { text: formatKrwShort(item.avgPrice) },
                competition: {
                  text: `${item.expectedCompetition}:1`,
                  tone: dDayBadgeKind(item.dDay) === 'pink' ? 'negative' : 'neutral',
                },
              },
            }))}
            emptyMessage="다가오는 청약이 없습니다"
          />
        </section>
      ) : null}
    </>
  );
}
