'use client';
import { useState, useEffect } from 'react';

const REGIONS = ['전국', '수도권', '부산', '대구', '인천', '광주', '대전', '울산'];

interface StatsData {
  region: string;
  totalUnits: number;
  siteCount: number;
  monthlyAvg: number;
  months: { month: string; total: number }[];
}

export default function UnsoldStatsWidget() {
  const [region, setRegion] = useState('전국');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/apt/unsold-stats?region=${encodeURIComponent(region)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [region]);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Region pills */}
      <div style={{
        display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 10, paddingBottom: 2,
      }}>
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            style={{
              padding: '4px 12px',
              borderRadius: 16,
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              border: `1px solid ${region === r ? 'var(--brand)' : 'var(--border)'}`,
              background: region === r ? '#2563EB' : 'transparent',
              color: region === r ? '#fff' : 'var(--text-tertiary)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Summary card */}
      {loading ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 16px',
        }}>
          <div style={{
            height: 16, width: '60%', borderRadius: 4,
            background: 'var(--bg-hover)',
            marginBottom: 10,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            height: 28, width: '80%', borderRadius: 4,
            background: 'var(--bg-hover)',
            marginBottom: 8,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            height: 12, width: '40%', borderRadius: 4,
            background: 'var(--bg-hover)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
      ) : stats ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '16px',
        }}>
          <div style={{
            fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8,
          }}>
            {'\uD83D\uDCCA'} {stats.region} 미분양 현황
          </div>
          <div style={{
            fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-red)', marginBottom: 6,
          }}>
            월평균 {stats.monthlyAvg.toLocaleString()}세대
          </div>
          <div style={{
            display: 'flex', gap: 16, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)',
          }}>
            <span>총 {stats.totalUnits.toLocaleString()}세대</span>
            <span>{stats.siteCount}개 현장</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
