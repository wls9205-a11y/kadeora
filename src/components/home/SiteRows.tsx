// M5 §B-1·B-2 — 홈 섹션의 «공통 줄».
//
// 네 섹션이 전부 같은 줄 구조를 쓴다. 반복되면 눈이 익어 읽는 속도가 붙는다.
//
//   [순위] 단지명 [단계배지]              [가격]
//          지역 · 세대수
//
// ⚠️ 가격은 반드시 lib/home/sections.ts 의 priceOf() 를 거친 값만 받는다.
//    지역 평균을 채워 넣은 가짜 값이 124곳에 붙어 있다 — 여기서 다시 판정하지 않는다.
//    판정이 두 곳에 있으면 한쪽만 고치게 된다.
// ⚠️ 순위는 「많이 보는 현장」에만 붙인다(rank 가 있을 때만).

import Link from 'next/link';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import type { HomeRow } from '@/lib/home/sections';

/** 만원 단위 → 억. price_min/max 는 만원이다 — 그대로 '원' 으로 읽으면 5억이 5만원이 된다. */
function priceText(p: NonNullable<HomeRow['price']>): string {
  const a = Math.round((p.min / 10000) * 10) / 10;
  const b = Math.round((p.max / 10000) * 10) / 10;
  return a === b ? `${a}억` : `${a}~${b}억`;
}

function metaText(r: HomeRow): string {
  const bits: string[] = [];
  const where = [r.region, r.sigungu].filter(Boolean).join(' ');
  if (where) bits.push(where);
  if (r.total_units && r.total_units > 0) bits.push(`${r.total_units.toLocaleString('ko-KR')}세대`);
  return bits.join(' · ');
}

export default function SiteRows({ items }: { items: HomeRow[] }) {
  if (items.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((r) => {
        const stage = lifecycleLabel(r.lifecycle_stage);
        return (
          <li key={r.slug} style={{ borderBottom: '1px solid var(--border)' }}>
            <Link
              href={`/apt/${encodeURIComponent(r.slug)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 3px', textDecoration: 'none', color: 'inherit',
              }}
            >
              {r.rank != null && (
                <span
                  style={{
                    width: 16, flexShrink: 0, textAlign: 'center',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                  }}
                >
                  {r.rank}
                </span>
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14, fontWeight: 600, lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {r.name}
                  </span>
                  {stage && (
                    <span
                      style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 500,
                        padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                        background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stage}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {metaText(r)}
                </div>
              </div>

              {/* 가격은 «있을 때만». 가짜 값은 이미 걸러져 null 로 온다. */}
              {r.price && (
                <span
                  style={{
                    flexShrink: 0, fontSize: 12, fontWeight: 500,
                    color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                  }}
                >
                  {priceText(r.price)}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * §B-2 — 더보기. 목록 «바닥» 에 둔다.
 *
 * 섹션 헤더 우측 작은 화살표는 눌러야 할지 모르고 지나친다.
 * 다 읽고 "더 없나" 싶을 때 손이 닿는 자리가 목록 아래다.
 * 그리고 «무엇이 더 있는지 문장으로» 적는다 — 「더보기」만 있으면 뭐가 나올지 몰라 안 누른다.
 *
 * ⚠️ 없는 라우트로 링크하지 않는다. 404 가 나면 안 만드느니만 못하다.
 */
export function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block', padding: '10px 3px 2px',
        fontSize: 12, fontWeight: 500, color: 'var(--brand-dark)',
        textDecoration: 'none',
      }}
    >
      {label} →
    </Link>
  );
}
