// s273 — ④ 이번 주 청약 결과.
// 최근 7일 안에 접수가 끝난 단지. 경쟁률이 들어오면 같이 보여준다.
//
// 주의: apt_competition_rates 는 2026-08-06 기준 0행이고
// apt_subscriptions.competition_rate_1st 도 2026-04-17 이후 갱신이 끊겨 있다.
// 그래서 지금은 "결과 집계 중" 문구가 기본값이다. 수집이 재개되면 자동으로 숫자가 뜬다.

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName } from '@/lib/apt/subscription-status';
import { statusBadgeStyle, statusLabel } from '@/lib/apt/subscription-badge';

function fmtDate(d: string | null): string {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return m && day ? `${Number(m)}/${Number(day)}` : '';
}

export default function SubscriptionResults({ items }: { items: AptHubItem[] }) {
  if (!items.length) return null;

  return (
    <section style={{ margin: '24px 0 0', padding: '0 6px' }} aria-labelledby="apt-results-heading">
      <h2 id="apt-results-heading" style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>
        이번 주 청약 결과
      </h2>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary, #9ca3af)', margin: '0 0 10px' }}>
        최근 7일 안에 접수가 끝난 {items.length}개 단지
      </p>

      <div style={{ display: 'grid', gap: 7 }}>
        {items.map((it) => {
          const name = formatComplexName(it.region_nm, it.house_nm);
          const hasNumbers = it.competition_rate != null || it.min_score != null;
          return (
            <Link
              key={it.id}
              href={aptHref(it)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '10px 11px',
                borderRadius: 8,
                border: '1px solid var(--border, #1e3258)',
                background: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-primary, #111827)',
                textDecoration: 'none',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary, #9ca3af)', marginTop: 2 }}>
                  {fmtDate(it.rcept_endde)} 마감
                  {it.households ? ` · ${it.households.toLocaleString('ko-KR')}세대` : ''}
                </div>
              </div>

              {hasNumbers ? (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {it.competition_rate != null ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
                      {Number(it.competition_rate).toFixed(1)}대 1
                    </div>
                  ) : null}
                  {it.min_score != null ? (
                    <div style={{ fontSize: 10.5, color: '#1d4ed8', marginTop: 1 }}>가점컷 {it.min_score}점</div>
                  ) : null}
                </div>
              ) : (
                <span style={{ ...statusBadgeStyle(it.status), flexShrink: 0 }}>{statusLabel(it.status)}</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
