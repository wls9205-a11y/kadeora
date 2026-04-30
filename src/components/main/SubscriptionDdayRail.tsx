// s220 메인 v5: SubscriptionDdayRail — 청약 D-Day 가로 스크롤 rail (server)
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
            return (
              <Link
                key={it.id}
                href={href}
                prefetch={false}
                style={{
                  flexShrink: 0,
                  width: 168,
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
                      width={168}
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
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 90 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {[it.region, it.sigungu].filter(Boolean).join(' ') || '지역 미정'}
                  </div>
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
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'auto' }}>
                    {fmtPriceRange(it.price_min, it.price_max)}
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
