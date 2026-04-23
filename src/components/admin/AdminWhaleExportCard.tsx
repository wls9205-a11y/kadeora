'use client';

import { useEffect, useState } from 'react';

export default function AdminWhaleExportCard() {
  const [count, setCount] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/whale-count', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCount(typeof d.count === 'number' ? d.count : 0))
      .catch(() => setCount(0));
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const r = await fetch('/api/admin/whale-export?min_pv=10', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whale_targets_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('다운로드 실패: ' + (e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(254,229,0,0.06)', border: '1px solid rgba(254,229,0,0.25)',
      borderRadius: 10, padding: '12px 14px', marginBottom: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#FEE500', marginBottom: 2 }}>
          🐋 미가입 고래 {count !== null ? `${count}명` : '...'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          10+ PV · 이메일/카톡 캠페인 타깃
        </div>
      </div>
      <button
        onClick={download}
        disabled={downloading || !count}
        style={{
          background: '#FEE500', color: '#191919',
          fontSize: 11, fontWeight: 700, padding: '6px 14px',
          borderRadius: 6, border: 'none',
          cursor: downloading ? 'wait' : !count ? 'not-allowed' : 'pointer',
          opacity: !count ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {downloading ? '...' : 'CSV ↓'}
      </button>
    </div>
  );
}
