'use client';
import { useState } from 'react';
import type { SegmentFilter } from './SegmentBuilder';

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export default function ExportButton({
  filter,
  segmentName,
}: {
  filter: SegmentFilter;
  segmentName: string;
}) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/marketing/kakao/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_json: filter, segment_name: segmentName }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kadeora_kakao_${segmentName || 'unnamed'}_${ymd()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('내보내기 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '8px 14px',
        borderRadius: 6,
        cursor: busy ? 'wait' : 'pointer',
        background: 'transparent',
        color: 'var(--text-secondary, #ccc)',
        border: '1px solid var(--border, #2a2b35)',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? '⏳ 생성 중…' : '📥 CSV 다운로드'}
    </button>
  );
}
