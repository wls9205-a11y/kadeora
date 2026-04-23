'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type CtaRow = {
  cta_name: string;
  views: number;
  clicks: number;
  dismisses: number;
  ctr_pct: number;
  dismiss_rate_pct: number;
  verdict: string;
};

export default function AdminCtaPerformancePanel() {
  const [rows, setRows] = useState<CtaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data, error } = await (sb as any)
          .from('v_admin_cta_performance_24h')
          .select('*');
        if (!cancelled && !error && data) setRows(data as CtaRow[]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 12, color: 'var(--text-tertiary)' }}>CTA 성능 로드 중...</div>;
  if (!rows.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
        📊 CTA 24h 성능 ({rows.length}개)
      </div>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'var(--bg-hover)' }}>
            <tr>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>CTA</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>View</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Click</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>CTR</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cta_name} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.cta_name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.views}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.clicks}</td>
                <td style={{
                  padding: '10px 12px', textAlign: 'right', fontWeight: 600,
                  color: r.ctr_pct >= 5 ? '#4ade80' : r.ctr_pct >= 1 ? '#fbbf24' : '#f87171',
                }}>
                  {r.ctr_pct}%
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
