'use client';
import { useState, useEffect } from 'react';

export default function UnsoldTrendMini({ region }: { region?: string }) {
  const [data, setData] = useState<{region_nm: string; recorded_month: string; total_unsold: number; change_from_prev: number}[]>([]);
  useEffect(() => {
    const url = region ? `/api/public/unsold-trend?region=${encodeURIComponent(region)}&limit=6` : '/api/public/unsold-trend?limit=6';
    fetch(url).then(r => r.json()).then(d => setData((d.data || []).reverse())).catch(() => {});
  }, [region]);

  if (!data.length) return null;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📉 미분양 추이{region ? ` (${region})` : ''}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40 }}>
        {data.map((d, i) => {
          const max = Math.max(...data.map(x => x.total_unsold || 1));
          const h = Math.max(4, (d.total_unsold / max) * 36);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '80%', height: h, borderRadius: 4, background: d.change_from_prev > 0 ? '#E24B4A60' : '#34D39960' }} />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.recorded_month?.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
