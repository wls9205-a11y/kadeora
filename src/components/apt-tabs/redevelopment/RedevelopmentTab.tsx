/**
 * RedevelopmentTab
 *
 * 재개발 탭 전체 조립. headline + stepper + 단지 카드 grid + 일정 리스트.
 */

import { HeroCard } from '../shared/HeroCard';
import { CompactRow } from '../shared/CompactRow';
import { PhaseStepper } from './PhaseStepper';
import type { RedevelopmentItem } from '../types';

type Props = {
  items: RedevelopmentItem[];
};

export function RedevelopmentTab({ items }: Props) {
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
        진행 중인 재개발이 없습니다.
      </div>
    );
  }

  const featured = items[0];
  const rest = items.slice(1);

  const headline = featured.nextMilestoneLabel
    ? `${featured.site.name} ${featured.nextMilestoneLabel} D-${featured.nextMilestoneDDay ?? '-'}, 흐름 본격화`
    : `${featured.site.name} 진행률 ${featured.progressPct}%, 다음 단계 준비 중`;

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
          재개발 진행
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

      {/* hero + stepper */}
      <section className="aptr-grid-asymmetric" style={{ marginBottom: '16px' }}>
        <HeroCard
          site={featured.site}
          badge={{ kind: 'amber', label: featured.phaseLabel }}
          topRightLabel={
            featured.nextMilestoneDDay ? `D-${featured.nextMilestoneDDay}` : undefined
          }
          subtitle={`${featured.phaseLabel} · 진행률 ${featured.progressPct}%${
            featured.members ? ` · 조합원 ${featured.members.toLocaleString('ko-KR')}` : ''
          }`}
          stats={[
            { label: '진행률', value: `${featured.progressPct}%`, tone: 'accent' },
            featured.nextMilestoneLabel
              ? { label: '다음 단계', value: featured.nextMilestoneLabel }
              : { label: '단계', value: featured.phaseLabel },
            featured.nextMilestoneDDay
              ? { label: '예정', value: `D-${featured.nextMilestoneDDay}` }
              : { label: '단계', value: featured.phaseLabel },
          ]}
          imageHeight={140}
          href={featured.href}
          priority
        />

        <PhaseStepper
          currentPhaseId={featured.phaseId}
          nextMilestoneLabel={featured.nextMilestoneLabel}
          nextMilestoneDDay={featured.nextMilestoneDDay}
        />
      </section>

      {/* 다른 단지들 */}
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
            <span>진행 중인 다른 단지</span>
            <a
              href="/apt/redevelopment"
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
                badge={{ kind: 'amber', label: item.phaseLabel }}
                title={item.site.name}
                meta={
                  item.nextMilestoneLabel && item.nextMilestoneDDay
                    ? `${item.nextMilestoneLabel} D-${item.nextMilestoneDDay}`
                    : item.phaseLabel
                }
                primaryValue={`${item.progressPct}%`}
                primaryValueTone="neutral"
                progressPercent={item.progressPct}
                isFirst={idx === 0}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
