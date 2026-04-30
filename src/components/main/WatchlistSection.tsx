/**
 * WatchlistSection — 추적중 단지 (server).
 * isLoggedIn=false → empty CTA, isLoggedIn=true → 가로 스크롤 카드 + 삭제 버튼.
 * 추가/삭제 인터랙션은 WatchlistAddButton (client) 분리.
 */
import Link from 'next/link';
import WatchlistAddButton from './WatchlistAddButton';
import type { WatchlistItem } from './types';

interface Props {
  items: WatchlistItem[];
  isLoggedIn: boolean;
}

function Sparkline({ data, color, width = 180, height = 40 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function fmtAmount(n: number | null): string {
  if (!n || n <= 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

export default function WatchlistSection({ items, isLoggedIn }: Props) {
  if (!isLoggedIn) {
    return (
      <section style={{ padding: 16, background: 'var(--bg-base)' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>추적중 단지</h2>
        <div style={{
          padding: 16, border: '0.5px solid var(--border)', borderRadius: 12,
          background: 'var(--bg-surface)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
            1,247명이 평균 3.2개 단지 추적 중
          </div>
          <Link
            href="/login?next=/watchlist&cta=watchlist_add_cta"
            style={{
              display: 'inline-block', padding: '8px 16px', borderRadius: 8,
              background: 'var(--brand)', color: 'var(--text-inverse, #fff)',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
            }}
          >
            추가하고 알림 받기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: 16, background: 'var(--bg-base)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          추적중 단지 <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>· {items.length}개</span>
        </h2>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center', border: '0.5px solid var(--border)', borderRadius: 8 }}>
          추적중 단지 없음. 단지 페이지에서 ★ 추가
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {items.map((it) => {
            const pct = it.change_pct_30d ?? 0;
            const up = pct >= 0;
            const color = up ? 'var(--accent-green, #22c55e)' : '#ef4444';
            return (
              <div
                key={it.apt.id}
                style={{
                  flex: '0 0 auto', width: 200, padding: 10,
                  border: '0.5px solid var(--border)', borderRadius: 10,
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
                  <Link
                    href={`/apt/${it.apt.slug}`}
                    style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                      textDecoration: 'none', flex: 1, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {it.apt.name}
                  </Link>
                  <WatchlistAddButton mode="remove" aptId={it.apt.id} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtAmount(it.current_price)}</span>
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                    {it.change_pct_30d !== null ? `${up ? '+' : ''}${it.change_pct_30d.toFixed(1)}%` : '-'}
                  </span>
                </div>
                <Sparkline data={it.sparkline_30d} color={color} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
