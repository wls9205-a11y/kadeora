'use client';
/**
 * MapModeToggle — 지도 모드 4-button toggle (client).
 * usePathname + useRouter 만 사용 (NOT useSearchParams).
 * 클릭 시 ?map_mode={next} 로 이동. 다른 query 보존은 부모에서 props 로 전달 받음.
 */
import { useRouter, usePathname } from 'next/navigation';

type MapMode = 'subscription' | 'trade' | 'unsold' | 'redev';

interface Props {
  mode: MapMode;
}

const MODES: Array<{ key: MapMode; label: string }> = [
  { key: 'subscription', label: '청약' },
  { key: 'trade', label: '실거래' },
  { key: 'unsold', label: '미분양' },
  { key: 'redev', label: '재개발' },
];

export default function MapModeToggle({ mode }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div role="tablist" style={{ display: 'inline-flex', gap: 4 }}>
      {MODES.map(({ key, label }) => {
        const active = key === mode;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => router.push(`${pathname}?map_mode=${key}`, { scroll: false })}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '0.5px solid var(--border)',
              background: active ? 'var(--brand)' : 'transparent',
              color: active ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: active ? 700 : 500,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
