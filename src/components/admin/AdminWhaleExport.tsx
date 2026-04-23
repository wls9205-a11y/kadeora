'use client';

import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function AdminWhaleExport() {
  const [downloading, setDownloading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const sb = createSupabaseBrowser();
      const { data, error } = await (sb as any).rpc('admin_export_whale_targets', { p_min_pv: 10 });
      if (error) throw error;

      const rows = (data as any[]) || [];
      const headers = ['visitor_id', 'pv', 'active_days', 'uniq_pages', 'deep_reads', 'last_seen_kst', 'primary_interest', 'top_pages'];
      const csv = [
        headers.join(','),
        ...rows.map((r) => [
          r.visitor_id,
          r.pv,
          r.active_days,
          r.uniq_pages,
          r.deep_reads,
          r.last_seen_kst,
          r.primary_interest,
          `"${(r.top_pages || []).join(' | ')}"`,
        ].join(',')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whale_targets_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setCount(rows.length);
    } catch (e) {
      alert('Export 실패: ' + (e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            🐋 미가입 고래 Export
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            10+ PV 이상 미가입 visitor — 이메일/푸시 캠페인용 CSV
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={downloading}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: downloading ? 'var(--bg-hover)' : 'var(--brand)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: downloading ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          {downloading ? '다운로드 중...' : count !== null ? `✓ ${count}건 다운로드` : 'CSV 다운로드'}
        </button>
      </div>
    </div>
  );
}
