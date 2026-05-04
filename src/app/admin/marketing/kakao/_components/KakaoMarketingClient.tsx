'use client';
import { useCallback, useState } from 'react';
import KakaoFunnel from './KakaoFunnel';
import SegmentBuilder, { type SegmentFilter } from './SegmentBuilder';
import SegmentSavedList from './SegmentSavedList';
import ExportButton from './ExportButton';
import SendModal from './SendModal';
import ConsentExpiryAlerts from './ConsentExpiryAlerts';

const DEFAULT_FILTER: SegmentFilter = {
  regions: [],
  marketing_required: true,
  channel_required: false,
  active_days: 30,
  message_type: 'ad',
  age_groups: [],
  genders: [],
};

export default function KakaoMarketingClient() {
  const [filter, setFilter] = useState<SegmentFilter>(DEFAULT_FILTER);
  const [segmentName, setSegmentName] = useState<string>('');
  const [sendOpen, setSendOpen] = useState(false);

  const applyFunnelFilter = useCallback((patch: Partial<SegmentFilter>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const applySavedSegment = useCallback((name: string, f: SegmentFilter) => {
    setSegmentName(name);
    setFilter(f);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KakaoFunnel onSegmentApply={applyFunnelFilter} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        <SegmentBuilder
          filter={filter}
          onFilterChange={setFilter}
          segmentName={segmentName}
          onSegmentNameChange={setSegmentName}
          onOpenSend={() => setSendOpen(true)}
        />
        <SegmentSavedList onApply={applySavedSegment} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ExportButton filter={filter} segmentName={segmentName} />
        <button
          onClick={() => setSendOpen(true)}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'var(--accent, #3b82f6)',
            color: '#fff',
            border: '1px solid var(--accent, #3b82f6)',
          }}
        >
          📤 직접 발송
        </button>
      </div>

      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        filter={filter}
        segmentName={segmentName}
      />

      <ConsentExpiryAlerts />
    </div>
  );
}
