'use client';
import { useEffect, useState } from 'react';
import type { SegmentFilter } from './SegmentBuilder';

interface SavedSegment {
  id: string | number;
  name: string;
  filter_json: SegmentFilter;
  count?: number;
  updated_at?: string;
}

export default function SegmentSavedList({
  onApply,
}: {
  onApply: (name: string, filter: SegmentFilter) => void;
}) {
  const [items, setItems] = useState<SavedSegment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/marketing/kakao/segment/list', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json();
        setItems(Array.isArray(j) ? j : j?.items ?? []);
        setErr(null);
      })
      .catch((e) => setErr(e?.message ?? 'fetch failed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-elevated, #1f2028)',
        border: '1px solid var(--border, #2a2b35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>저장된 세그먼트</h2>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-tertiary, #888)' }}>로드 중…</div>}
      {err && <div style={{ fontSize: 12, color: '#f87171' }}>실패: {err}</div>}
      {!loading && items.length === 0 && !err && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #888)' }}>저장된 세그먼트가 없습니다.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onApply(it.name, it.filter_json)}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              background: 'var(--bg-base, #0d0e14)',
              border: '1px solid var(--border, #2a2b35)',
              color: 'var(--text-primary, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{it.name}</span>
              {it.updated_at && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary, #888)' }}>
                  {new Date(it.updated_at).toLocaleString()}
                </span>
              )}
            </div>
            {it.count != null && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
                {it.count.toLocaleString()}명
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
