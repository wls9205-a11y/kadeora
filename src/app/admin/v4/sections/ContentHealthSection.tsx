'use client';
import React from 'react';
import AdminKPI from '../components/AdminKPI';

interface HubBucket { mapped?: number; total?: number; pct?: number }

interface Props {
  data: {
    meta_pct?: number;
    alt_pct?: number;
    excerpt_pct?: number;
    published?: number;
    hub_by_category?: Record<string, HubBucket>;
  };
}

function healthFor(pct: number | undefined): 'ok' | 'warn' | 'critical' {
  const v = pct ?? 0;
  if (v >= 95) return 'ok';
  if (v >= 70) return 'warn';
  return 'critical';
}

export default function ContentHealthSection({ data }: Props) {
  const hub = data.hub_by_category ?? {};
  const cats = Object.keys(hub);

  return (
    <section style={{
      padding: 16, borderRadius: 'var(--radius-lg, 14px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', marginTop: 0, marginBottom: 10 }}>
        📚 콘텐츠 위생
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="메타 설명" value={`${data.meta_pct ?? 0}%`} health={healthFor(data.meta_pct)} />
        <AdminKPI label="이미지 alt" value={`${data.alt_pct ?? 0}%`} health={healthFor(data.alt_pct)} />
        <AdminKPI label="발췌문" value={`${data.excerpt_pct ?? 0}%`} health={healthFor(data.excerpt_pct)} />
        <AdminKPI label="누적 발행" value={(data.published ?? 0).toLocaleString()} />
      </div>

      <div style={{
        marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)',
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>
        카테고리별 허브 매핑
      </div>
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--text-tertiary, #888)' }}>
              <th style={{ padding: 6, textAlign: 'left' }}>카테고리</th>
              <th style={{ padding: 6, textAlign: 'right' }}>매핑됨</th>
              <th style={{ padding: 6, textAlign: 'right' }}>전체</th>
              <th style={{ padding: 6, textAlign: 'right' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(c => {
              const b = hub[c];
              const pct = b.pct ?? 0;
              const color = pct >= 70 ? 'var(--accent-green, #34d399)' : pct >= 30 ? 'var(--accent-orange, #fb923c)' : 'var(--accent-red, #f87171)';
              return (
                <tr key={c} style={{ borderTop: '1px solid var(--border, #2a2b35)' }}>
                  <td style={{ padding: 6 }}><code style={{ color: 'var(--text-secondary, #ccc)' }}>{c}</code></td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{(b.mapped ?? 0).toLocaleString()}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: 'var(--text-tertiary, #888)' }}>{(b.total ?? 0).toLocaleString()}</td>
                  <td style={{ padding: 6, textAlign: 'right', color, fontWeight: 700 }}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
