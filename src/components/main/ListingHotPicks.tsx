/**
 * ListingHotPicks — 분양중 핫픽 2-col grid (server).
 *
 * s221 변경:
 *   - 카드 padding 8 → 9px
 *   - 정보 풍부화 (5 → 7 필드): 시공사·총세대수·입주예정·잔여수치·할인율 추가
 *   - 시군구 렌더 제거 (사용자 요구: "시군구 중에 군 구 까지 표현될 필요는 없어")
 *   - 비어있는 행은 fallback hidden — cron backfill 후 자동 표시
 */
import Link from 'next/link';
import type { MainListing } from './types';

interface Props {
  items: MainListing[];
}

function fmtAmount(n: number | null): string {
  if (!n || n <= 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

// "202904" → "29.04 입주" / "" → null
function fmtMoveIn(ym: string | null): string | null {
  if (!ym) return null;
  const digits = ym.replace(/[^\d]/g, '');
  if (digits.length < 6) return null;
  const yy = digits.slice(2, 4);
  const mm = digits.slice(4, 6);
  return `${yy}.${mm} 입주`;
}

function statusLabel(s: MainListing['status']): { label: string; bg: string; color: string } {
  if (s === 'unsold') return { label: '미분양', bg: 'rgba(249,115,22,0.18)', color: 'var(--accent-orange, #f97316)' };
  if (s === 'closed') return { label: '마감', bg: 'rgba(148,163,184,0.18)', color: 'var(--text-tertiary)' };
  return { label: '분양중', bg: 'rgba(34,197,94,0.18)', color: 'var(--accent-green, #22c55e)' };
}

export default function ListingHotPicks({ items }: Props) {
  return (
    <section style={{ padding: 16, background: 'var(--bg-base)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>분양중 핫픽</h2>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center', border: '0.5px solid var(--border)', borderRadius: 8 }}>
          분양중 단지 없음
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {items.map((item) => {
            const st = statusLabel(item.status);
            const moveIn = fmtMoveIn(item.move_in_ym);
            const builderUnitsLine = [
              item.builder,
              item.total_units ? `${item.total_units.toLocaleString()}세대` : null,
            ].filter(Boolean).join(' · ');
            const sizesLine = (item.sizes && item.sizes.length > 0)
              ? item.sizes.slice(0, 4).join(' · ') + '㎡'
              : null;
            const isUnsold = item.status === 'unsold';
            return (
              <Link
                key={item.id}
                href={`/apt/${item.slug}`}
                style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ width: '100%', height: 100, background: 'var(--bg-hover, #1a1a1a)', overflow: 'hidden' }}>
                  {item.og_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.og_image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  )}
                </div>
                <div style={{ padding: 9, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* 지역 — region 만 (sigungu 제거) */}
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {item.region || ''}
                  </div>
                  {/* 단지명 */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  {/* 시공사 + 총세대수 */}
                  {builderUnitsLine && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {builderUnitsLine}
                    </div>
                  )}
                  {/* 평형 */}
                  {sizesLine && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sizesLine}
                    </div>
                  )}
                  {/* 분양가 + 상태 라벨 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600, flexShrink: 0 }}>
                      {st.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {fmtAmount(item.price_min)}~{fmtAmount(item.price_max)}
                    </span>
                  </div>
                  {/* 입주예정 + 잔여 / 할인율 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                    {moveIn && (
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {moveIn}
                      </span>
                    )}
                    {isUnsold && item.discount_pct ? (
                      <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>
                        -{item.discount_pct}% 할인
                      </span>
                    ) : item.remaining_units ? (
                      <span style={{ fontSize: 10, color: 'var(--accent-orange, #f97316)', fontWeight: 700 }}>
                        잔여 {item.remaining_units.toLocaleString()}세대
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
