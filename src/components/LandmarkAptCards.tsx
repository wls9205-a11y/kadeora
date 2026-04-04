'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LandmarkApt { name: string; region: string; district: string; avg_price_100m: string; avg_jeonse_100m: string; nearby_station: string; built_year: number; }

export default function LandmarkAptCards() {
  const [apts, setApts] = useState<LandmarkApt[]>([]);
  useEffect(() => {
    fetch('/api/public/landmark-apts').then(r => r.json()).then(d => setApts(d.data || [])).catch(() => {});
  }, []);
  if (!apts.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, marginBottom: 8 }}>🏙️ 지역 대장 아파트</div>
      <div className="apt-pill-scroll kd-scroll-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {apts.slice(0, 8).map((a, i) => (
          <Link href={`/apt/complex/${encodeURIComponent(a.name)}`} key={i} style={{
            minWidth: 140, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', textDecoration: 'none', flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.region} {a.district}</div>
            {a.avg_price_100m && <div style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A', marginTop: 4 }}>{a.avg_price_100m}</div>}
            {a.nearby_station && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>🚇 {a.nearby_station}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
