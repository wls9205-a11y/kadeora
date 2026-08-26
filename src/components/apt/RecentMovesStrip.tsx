// V16 E-3 — 이번 주 움직인 현장.
//
// /apt 상단 가로 스트립. 카더라가 남보다 빠르다는 걸 보여주는 자리다.
// 목록 행(.kd-lrow)이 아니라 스트립인 이유: 상단에서 세로를 많이 먹으면
// 청약 목록이 첫 화면에서 밀려난다. 훑고 지나가는 정보라 가로가 맞다.
//
// ⚠️ 0건이면 호출부에서 렌더하지 않는다.
// ⚠️ 등급을 감추지 않는다 — 추정·카더라는 그렇게 보이게 둔다.

import Link from 'next/link';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import type { AptRecentMove } from '@/lib/apt/recent-moves';

/** 확정만 브랜드 색. 추정·카더라를 같은 색으로 찍으면 훑고 확정으로 읽는다. */
const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  confirmed: { bg: 'var(--accent-green-bg)', fg: 'var(--accent-green)', label: '확정' },
  estimated: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)', label: '추정' },
  rumor: { bg: 'var(--bg-sunken)', fg: 'var(--text-tertiary)', label: '카더라' },
};

function daysAgo(iso: string, now: number): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = Math.floor((now - t) / 86_400_000);
  if (d <= 0) return '오늘';
  if (d === 1) return '어제';
  return `${d}일 전`;
}

export default function RecentMovesStrip({
  items,
  region,
  now,
}: {
  items: AptRecentMove[];
  region: string;
  now: number;
}) {
  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby="apt-moves-heading" style={{ padding: '0 6px', margin: '0 0 var(--sp-md)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <h2
          id="apt-moves-heading"
          style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, letterSpacing: '-.0125em', color: 'var(--text-primary)' }}
        >
          이번 주 움직인 현장
        </h2>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {region} · 최근 7일
        </span>
      </div>

      <ul
        style={{
          display: 'flex',
          gap: 6,
          listStyle: 'none',
          margin: 0,
          padding: '0 0 4px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {items.map((m) => {
          const tone = TONE[m.confidence ?? 'confirmed'] ?? TONE.confirmed;
          const to = lifecycleLabel(m.to_stage);
          const from = lifecycleLabel(m.from_stage);
          const when = daysAgo(m.occurred_at, now);
          const where = [m.region, m.sigungu].filter(Boolean).join(' ');

          return (
            <li key={m.id} style={{ flex: '0 0 auto' }}>
              <Link
                href={`/apt/${encodeURIComponent(m.site_slug ?? '')}`}
                style={{
                  display: 'block',
                  width: 172,
                  padding: '10px 11px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <span
                    style={{
                      padding: '1.5px 5px',
                      borderRadius: 3,
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 500,
                      background: tone.bg,
                      color: tone.fg,
                    }}
                  >
                    {tone.label}
                  </span>
                  {when && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-tertiary)' }}>{when}</span>}
                </span>

                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    letterSpacing: 0,   // fs-xs(14px) — 자간 규칙상 14px 이하는 0
                    lineHeight: 1.35,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </span>

                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--fs-xs)',
                    lineHeight: 1.45,
                    color: 'var(--brand)',
                    fontWeight: 500,
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {from ? `${from} → ` : ''}
                  {to ?? '단계 변경'}
                </span>

                {where && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {where}
                    {m.builder ? ` · ${m.builder}` : ''}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
