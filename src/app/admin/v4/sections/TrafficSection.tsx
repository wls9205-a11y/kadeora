'use client';
import { useEffect, useState, useCallback } from 'react';
import AdminKPI from '../components/AdminKPI';

interface HourlyPoint { pv: number; uv: number; hour: string }
interface TopPage { pv: number; uv: number; path: string }
interface TopReferrer { cnt: number; referrer: string }
interface DeviceSplit { mobile?: number; desktop?: number; tablet?: number }
interface CategorySplit { [key: string]: number }

interface TrafficData {
  pv_5min?: number; uv_5min?: number;
  pv_1h?: number; uv_1h?: number;
  pv_today?: number; uv_today?: number;
  pv_24h?: number; uv_24h?: number;
  hourly_24h?: HourlyPoint[];
  top_pages_1h?: TopPage[];
  top_referrers_24h?: TopReferrer[];
  device_split_24h?: DeviceSplit;
  category_split_24h?: CategorySplit;
}

const subTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)',
  textTransform: 'uppercase', marginTop: 14, marginBottom: 6, letterSpacing: 0.4,
};

function decodePath(p: string): string {
  try { return decodeURIComponent(p); } catch { return p; }
}

function fmtHour(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric' });
  } catch { return iso.slice(11, 13); }
}

export default function TrafficSection() {
  const [data, setData] = useState<TrafficData | null>(null);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/admin/v4/traffic', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j?.ok) setData(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    document.addEventListener('visibilitychange', fetchData);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', fetchData);
    };
  }, [fetchData]);

  const d = data ?? {};
  const hourly = d.hourly_24h ?? [];
  const maxPv = Math.max(1, ...hourly.map(h => h.pv ?? 0));
  const top = d.top_pages_1h ?? [];
  const refs = d.top_referrers_24h ?? [];
  const dev = d.device_split_24h ?? {};
  const devTotal = (dev.mobile ?? 0) + (dev.desktop ?? 0) + (dev.tablet ?? 0);
  const cat = d.category_split_24h ?? {};
  const catEntries = Object.entries(cat).sort((a, b) => Number(b[1]) - Number(a[1]));

  return (
    <section style={{
      padding: 16, borderRadius: 'var(--radius-lg, 14px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', marginTop: 0, marginBottom: 10 }}>
        🌐 실시간 트래픽
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <AdminKPI label="5분 PV" value={d.pv_5min ?? 0} delta={`UV ${d.uv_5min ?? 0}`} />
        <AdminKPI label="1시간 PV" value={d.pv_1h ?? 0} delta={`UV ${d.uv_1h ?? 0}`} />
        <AdminKPI label="오늘 PV" value={(d.pv_today ?? 0).toLocaleString()} delta={`UV ${(d.uv_today ?? 0).toLocaleString()}`} />
        <AdminKPI label="24시간 PV" value={(d.pv_24h ?? 0).toLocaleString()} delta={`UV ${(d.uv_24h ?? 0).toLocaleString()}`} />
      </div>

      {/* 24시간 막대 차트 */}
      <div style={subTitleStyle}>24시간 시간별 트래픽</div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2, height: 80,
        padding: '8px 10px', borderRadius: 8,
        background: 'var(--bg-surface, #1a1b22)', border: '1px solid var(--border, #2a2b35)',
        overflowX: 'auto',
      }}>
        {hourly.map((h, i) => {
          const pv = h.pv ?? 0;
          const heightPct = (pv / maxPv) * 100;
          return (
            <div
              key={i}
              title={`${fmtHour(h.hour)} · PV ${pv} · UV ${h.uv ?? 0}`}
              style={{
                flex: '1 0 auto', minWidth: 12,
                height: `${Math.max(4, heightPct)}%`,
                background: 'linear-gradient(180deg, var(--accent, #3b82f6) 0%, rgba(59,130,246,0.4) 100%)',
                borderRadius: '2px 2px 0 0',
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* TOP 페이지 */}
        <div>
          <div style={subTitleStyle}>인기 페이지 1시간 (TOP 10)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ color: 'var(--text-tertiary, #888)', textAlign: 'left' }}>
                  <th style={{ padding: 6 }}>경로</th>
                  <th style={{ padding: 6, textAlign: 'right' }}>PV</th>
                  <th style={{ padding: 6, textAlign: 'right' }}>UV</th>
                </tr>
              </thead>
              <tbody>
                {top.slice(0, 10).map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border, #2a2b35)' }}>
                    <td style={{ padding: 6, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <code style={{ color: 'var(--text-secondary, #ccc)' }}>{decodePath(p.path)}</code>
                    </td>
                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{p.pv}</td>
                    <td style={{ padding: 6, textAlign: 'right', color: 'var(--text-tertiary, #888)' }}>{p.uv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Referrer */}
        <div>
          <div style={subTitleStyle}>유입 경로 24시간</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {refs.map((r, i) => {
              const total = refs.reduce((a, b) => a + (b.cnt ?? 0), 0);
              const pct = total > 0 ? Math.round((r.cnt / total) * 100) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ minWidth: 80, color: 'var(--text-secondary, #ccc)' }}>{r.referrer}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent, #3b82f6)' }} />
                  </div>
                  <span style={{ minWidth: 40, textAlign: 'right', color: 'var(--text-primary, #fff)', fontWeight: 700 }}>{r.cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 기기 + 카테고리 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div>
          <div style={subTitleStyle}>기기 분포 24시간</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { k: 'mobile',  label: '모바일',  v: dev.mobile ?? 0, color: '#34d399' },
              { k: 'desktop', label: '데스크탑', v: dev.desktop ?? 0, color: '#60a5fa' },
              { k: 'tablet',  label: '태블릿',   v: dev.tablet ?? 0, color: '#fb923c' },
            ].map(it => {
              const pct = devTotal > 0 ? Math.round((it.v / devTotal) * 100) : 0;
              return (
                <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ minWidth: 60, color: 'var(--text-secondary, #ccc)' }}>{it.label}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: it.color }} />
                  </div>
                  <span style={{ minWidth: 60, textAlign: 'right', color: 'var(--text-primary, #fff)', fontWeight: 700 }}>{it.v} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div style={subTitleStyle}>카테고리 분포 24시간</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {catEntries.map(([k, v]) => (
              <div key={k} style={{
                padding: '4px 10px', borderRadius: 6,
                background: 'var(--bg-surface, #1a1b22)', border: '1px solid var(--border, #2a2b35)',
                fontSize: 11,
              }}>
                <code style={{ color: 'var(--text-secondary, #ccc)' }}>{k}</code>
                <span style={{ marginLeft: 6, color: 'var(--text-primary, #fff)', fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
