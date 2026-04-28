'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KR_REGIONS_17, getStoredRegion, setStoredRegion } from '@/lib/region-storage';
import RegionPicker from '@/components/apt/RegionPicker';

interface Props {
  defaultRegion: string;
}

export default function RegionHero({ defaultRegion }: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string>(defaultRegion);

  // mount 시 localStorage 에 region 이 있으면 즉시 redirect — 첫 paint 후에 client 에서만 실행.
  useEffect(() => {
    const stored = getStoredRegion();
    if (stored?.region) {
      const params = new URLSearchParams();
      params.set('region', stored.region);
      if (stored.sigungu) params.set('sigungu', stored.sigungu);
      router.replace(`/apt?${params.toString()}`);
    }
  }, [router]);

  const goWithRegion = (region: string) => {
    setStoredRegion(region, null);
    router.replace(`/apt?region=${encodeURIComponent(region)}`);
  };

  return (
    <>
      <section
        aria-label="지역 선택"
        style={{
          maxWidth: 720, margin: '24px auto 12px',
          padding: '24px var(--sp-lg)',
          background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-hover) 100%)',
          border: '1px solid var(--border)', borderRadius: 14,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>
          📍 어느 지역을 보고 계신가요?
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px', lineHeight: 1.6 }}>
          17개 시·도 + 246개 시·군·구의 청약·분양·미분양·재개발 정보를 모았습니다.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="시도 선택"
            style={{
              flex: 1, minWidth: 140,
              padding: '10px 12px', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              background: 'var(--bg-base)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', cursor: 'pointer',
              outline: 'none',
            }}
          >
            {KR_REGIONS_17.map((r) => (
              <option key={r} value={r}>
                {r}{r === defaultRegion ? ' (현재 지역)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => goWithRegion(selected)}
            style={{
              padding: '10px 18px', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              background: 'var(--brand)', color: 'var(--text-inverse, #fff)',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            이 지역 보기 →
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              padding: '8px 14px', borderRadius: 999,
              fontSize: 12, fontWeight: 700,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            📍 시·군·구까지 선택
          </button>
          <button
            onClick={() => goWithRegion('전국')}
            style={{
              padding: '8px 14px', borderRadius: 999,
              fontSize: 12, fontWeight: 700,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            전국 보기
          </button>
        </div>

        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '14px 0 0', opacity: 0.7 }}>
          IP 기반으로 “{defaultRegion}”을 기본 선택했습니다. 다른 지역을 보려면 위 버튼/드롭다운을 사용하세요.
        </p>
      </section>

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} initialRegion={selected} />
    </>
  );
}
