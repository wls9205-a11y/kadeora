'use client';
import { useCallback, useEffect, useState } from 'react';
import type { SegmentFilter } from './SegmentBuilder';

interface FunnelData {
  total?: number;
  active?: number;
  marketing_agreed?: number;
  marketing_active?: number;
  channel_friends?: number;
  eligible?: number;
  eligible_with_night?: number;
  expiring_soon?: number;
}

interface FunnelCard {
  key: keyof FunnelData;
  label: string;
  filterPatch: Partial<SegmentFilter>;
}

const CARDS: FunnelCard[] = [
  { key: 'total',              label: '가입',          filterPatch: {} },
  { key: 'active',             label: '활성',          filterPatch: { active_days: 30 } },
  { key: 'marketing_agreed',   label: '마케팅 동의',   filterPatch: { marketing_required: true } },
  { key: 'marketing_active',   label: '동의 유효',     filterPatch: { marketing_required: true, active_days: 30 } },
  { key: 'channel_friends',    label: '채널 친구',     filterPatch: { channel_required: true } },
  { key: 'eligible',           label: '발송 가능',     filterPatch: { marketing_required: true, channel_required: true, active_days: 30 } },
  { key: 'eligible_with_night',label: '야간 동의',     filterPatch: { marketing_required: true, channel_required: true, active_days: 30, message_type: 'ad' } },
  { key: 'expiring_soon',      label: '만료 임박',     filterPatch: { marketing_required: true } },
];

export default function KakaoFunnel({
  onSegmentApply,
}: {
  onSegmentApply: (filter: Partial<SegmentFilter>) => void;
}) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/admin/marketing/kakao/funnel', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json();
        setData(j);
        setErr(null);
      })
      .catch((e) => setErr(e?.message ?? 'fetch failed'));
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    document.addEventListener('visibilitychange', fetchData);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', fetchData);
    };
  }, [fetchData]);

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-elevated, #1f2028)',
        border: '1px solid var(--border, #2a2b35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>퍼널</h2>
        {err && <span style={{ fontSize: 11, color: '#f87171' }}>로드 실패: {err}</span>}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {CARDS.map((c) => {
          const v = data?.[c.key];
          return (
            <button
              key={c.key}
              onClick={() => onSegmentApply(c.filterPatch)}
              style={{
                textAlign: 'left',
                padding: 12,
                borderRadius: 8,
                background: 'var(--bg-base, #0d0e14)',
                border: '1px solid var(--border, #2a2b35)',
                color: 'var(--text-primary, #fff)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>{c.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800 }}>
                {v == null ? '—' : v.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
