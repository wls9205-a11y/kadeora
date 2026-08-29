// s273 — /apt 히어로. 청약 타임라인 가로 스크롤.
// 상태 배지 + D-day 를 한 줄로 훑게 만드는 것이 목적. 서버 컴포넌트 (상호작용 없음).

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName } from '@/lib/apt/subscription-status';
import { statusBadgeStyle, statusLabel, ddayLabel, ddayStyle } from '@/lib/apt/subscription-badge';
import SectionHeader from '@/components/apt/SectionHeader';

function shortDate(d: string | null): string {
  if (!d) return '';
  const [, m, day] = d.split('-');
  if (!m || !day) return '';
  return `${Number(m)}/${Number(day)}`;
}

export default function SubscriptionTimeline({
  items,
  region,
}: {
  items: AptHubItem[];
  region: string;
}) {
  if (!items.length) return null;

  return (
    <section style={{ margin: '0 0 16px' }} aria-labelledby="apt-timeline-heading">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 6px',
          marginBottom: 8,
        }}
      >
        <SectionHeader
          id="apt-timeline-heading"
          eyebrow="TIMELINE — 청약 일정"
          title="청약 타임라인"
          meta={`${region} · ${items.length}개 단지`}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-sm)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          padding: '2px 6px 8px',
          scrollbarWidth: 'none',
        }}
      >
        {items.map((it) => {
          const name = formatComplexName(it.region_nm, it.house_nm);
          const dd = ddayLabel(it.status, it.dday);
          return (
            <Link
              key={it.id}
              href={aptHref(it)}
              style={{
                flex: '0 0 auto',
                width: 168,
                scrollSnapAlign: 'start',
                display: 'block',
                padding: '10px 11px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-sm)', marginBottom: 6 }}>
                <span style={statusBadgeStyle(it.status)}>{statusLabel(it.status)}</span>
                {dd ? <span style={ddayStyle(it.dday)}>{dd}</span> : null}
              </div>

              <div
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  minHeight: 34,
                  wordBreak: 'keep-all',
                }}
              >
                {name}
              </div>

              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 6 }}>
                {it.rcept_bgnde ? `접수 ${shortDate(it.rcept_bgnde)}~${shortDate(it.rcept_endde)}` : '일정 미정'}
              </div>
              {it.households ? (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {it.households.toLocaleString('ko-KR')}세대
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
