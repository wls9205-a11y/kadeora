'use client';

import { useEffect, useState } from 'react';
import { setStoredRegion } from '@/lib/region-storage';
import RegionPicker from '@/components/apt/RegionPicker';

interface Props {
  region: string;
  sigungu: string | null;
}

export default function RegionHeader({ region, sigungu }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // URL → localStorage 동기화 (URL 로 직접 진입한 경우 재방문 시 같은 지역 유지)
  useEffect(() => {
    if (region) setStoredRegion(region, sigungu);
  }, [region, sigungu]);

  const label = sigungu ? `${region} · ${sigungu}` : region;

  return (
    <>
      <div
        role="banner"
        aria-label="현재 지역"
        style={{
          position: 'sticky', top: 44, zIndex: 50,
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border)',
          padding: '8px var(--sp-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span aria-hidden style={{ fontSize: 14 }}>📍</span>
          <span style={{
            fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          aria-label="지역 변경"
          style={{
            padding: '9px 14px', borderRadius: 999,
            fontSize: 12, fontWeight: 700,
            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          지역 변경 ▾
        </button>
      </div>

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} initialRegion={region} />
    </>
  );
}
