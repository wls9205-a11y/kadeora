// s221 메인 v5: SubscriptionDdayRail — 청약 D-Day 가로 스크롤 rail (server)
//
// s221 변경:
//   - 카드 폭 168px → 178px
//   - 정보 풍부화 (5 → 9 필드): 시공사·평형·세대수·입주예정·특징태그·청약일정 추가
//   - 시군구 렌더 제거 (사용자 요구: "시군구 중에 군 구 까지 표현될 필요는 없어")
//   - 비어있는 행은 fallback hidden — cron backfill 후 자동 표시
import Link from 'next/link';
import type { MainSubscription } from './types';

interface Props {
  items: MainSubscription[];
}

function fmtAmount(n: number | null): string {
  if (!n) return '-';
  return n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
}

function fmtPriceRange(min: number | null, max: number | null): string {
  if (!min && !max) return '분양가 미정';
  if (min && max && min !== max) return `${fmtAmount(min)} ~ ${fmtAmount(max)}`;
  return fmtAmount(min ?? max);
}

// "202904" → "29.04 입주" / "" → null
function fmtMoveIn(ym: string | null): string | null {
  if (!ym || ym.length < 6) return null;
  const yy = ym.slice(2, 4);
  const mm = ym.slice(4, 6);
  return `${yy}.${mm} 입주`;
}

// "2026-05-04" → "5/4"
function fmtDate(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${parseInt(m[2], 10)}/${parseInt(m[3], 10)}`;
}

function fmtCompetition(n: number | null): string | null {
  if (n === null || n === undefined || n <= 0) return null;
  return `예상 ${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}:1`;
}

function ddayBadge(dday: number) {
  let bg = 'var(--accent-green)';
  let label = `D-${dday}`;
  if (dday <= 0) { bg = '#dc2626'; label = '오늘 마감'; }
  else if (dday <= 3) { bg = '#dc2626'; }
  else if (dday <= 7) { bg = 'var(--accent-yellow)'; }
  return { bg, label };
}

function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#1E40AF', '#7C3AED', '#0F766E', '#B45309', '#1D4ED8', '#6D28D9', '#047857', '#92400E'];
  return colors[Math.abs(hash) % colors.length];
}

export default function SubscriptionDdayRail({ items }: Props) {
  return (
    <section style={{ marginTop: 16, marginBottom: 20 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
          padding: '0 4px',
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
          ⏰ 청약 D-Day
        </h2>
        <Link
          href="/login?next=/apt/alerts&cta=apt_alert_cta_global"
          style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}
        >
          전체 알림 받기 →
        </Link>
      </header>

      {items.length === 0 ? (
        <div
          style={{
            padding: '20px 12px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          이번 주 청약 일정 없음
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            margin: '0 -16px',
            padding: '0 16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <style>{`section > div::-webkit-scrollbar{display:none}`}</style>
          {items.map((it) => {
            const badge = ddayBadge(it.dday);
            const href = `/apt/${it.slug ?? it.id}`;
            const competition = fmtCompetition(it.expected_competition);
            const moveIn = fmtMoveIn(it.move_in_ym);
            const householdLine = [
              it.total_units ? `${it.total_units.toLocaleString()}세대` : null,
              moveIn,
            ].filter(Boolean).join(' · ');
            const sizesLine = (it.sizes && it.sizes.length > 0)
              ? it.sizes.slice(0, 4).join(' · ')
              : null;
            const tags = (it.feature_tags || []).slice(0, 4);
            const applyStart = fmtDate(it.rcept_bgnde);
            const applyEnd = fmtDate(it.rcept_endde);
            const applyLine = applyStart && applyEnd ? `청약 ${applyStart}~${applyEnd}` : null;
            return (
              <Link
                key={it.id}
                href={href}
                prefetch={false}
                style={{
                  flexShrink: 0,
                  width: 178,
                  borderRadius: 'var(--radius-card)',
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-surface)',
                  textDecoration: 'none',
                  color: 'inherit',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 100,
                    background: it.og_image_url ? '#0a0a0a' : hashColor(it.name),
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {it.og_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.og_image_url}
                      alt={it.name}
                      width={178}
                      height={100}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: badge.bg,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {badge.label}
                  </span>
                  {competition && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        padding: '3px 6px',
                        borderRadius: 4,
                        background: 'rgba(0,0,0,0.55)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      {competition}
                    </span>
                  )}
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* 지역 — region 만 (sigungu 제거) */}
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {it.region || '지역 미정'}
                  </div>
                  {/* 단지명 */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'keep-all',
                    }}
                  >
                    {it.name}
                  </div>
                  {/* 시공사 */}
                  {it.builder && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.builder}
                    </div>
                  )}
                  {/* divider */}
                  <div style={{ height: 0.5, background: 'var(--border)', margin: '4px 0' }} />
                  {/* 평형 */}
                  {sizesLine && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sizesLine}㎡
                    </div>
                  )}
                  {/* 분양가 */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtPriceRange(it.price_min, it.price_max)}
                  </div>
                  {/* 세대수 + 입주예정 */}
                  {householdLine && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {householdLine}
                    </div>
                  )}
                  {/* 특징 태그 */}
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                      {tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 9,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'rgba(99,102,241,0.14)',
                            color: 'var(--brand)',
                            fontWeight: 600,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 청약 일정 강조 */}
                  {applyLine && (
                    <div style={{ fontSize: 10, color: 'var(--accent-green)', fontWeight: 700, marginTop: 2 }}>
                      {applyLine}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
