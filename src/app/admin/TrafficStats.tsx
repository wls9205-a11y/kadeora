'use client';
import { useState, useEffect } from 'react';

interface TrafficStatsProps {
  variant?: 'kpi' | 'full';
}

export default function TrafficStats({ variant = 'full' }: TrafficStatsProps) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics/visitors').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  // KPI variant - just show today's visitor count
  if (variant === 'kpi') {
    if (!data) return <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-tertiary)' }}>--</div>;
    return (
      <>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{(data.daily ?? 0).toLocaleString()}명</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>7일 {data.weekly ?? 0}명 · 30일 {data.monthly ?? 0}명</div>
      </>
    );
  }

  // Full variant
  if (!data) return <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: 16 }}>트래픽 로딩 중...</div>;

  const maxH = Math.max(...(data.hourly || []).map((h: any) => h.count), 1);

  return (
    <div>
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>📊 트래픽 현황</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { label: '오늘', value: data.daily, icon: '📅' },
          { label: '7일', value: data.weekly, icon: '📆' },
          { label: '30일', value: data.monthly, icon: '🗓️' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-base)' }}>{s.icon}</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--brand)', margin: '2px 0' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>방문자 ({s.label})</div>
          </div>
        ))}
      </div>

      {data.topPaths?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>인기 페이지 (7일)</div>
          {data.topPaths.map((p: any, i: number) => (
            <div key={p.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < data.topPaths.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{p.path}</span>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{p.count}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>시간대별 (오늘)</div>
        <svg width="100%" viewBox="0 0 240 70" style={{ display: 'block' }}>
          {(data.hourly || []).map((h: any, i: number) => (
            <g key={i}>
              <rect x={i * 10} y={60 - Math.max((h.count / maxH) * 50, 2)} width={6} height={Math.max((h.count / maxH) * 50, 2)} rx={1} fill="var(--brand)" opacity={0.7} />
              {i % 6 === 0 && <text x={i * 10 + 3} y={68} textAnchor="middle" fontSize={7} fill="var(--text-tertiary)">{h.hour}</text>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
