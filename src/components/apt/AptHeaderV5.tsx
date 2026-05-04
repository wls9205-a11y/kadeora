'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RegionSheetV5 from './RegionSheetV5';

interface Props {
  region: string;
  totalCount: number;
  imminentCount: number;
  cat: { total: number; ongoing: number; unsold: number; redev: number; trade: number };
  sido: Array<{ name: string; count: number }>;
  activeTab: string;
}

export default function AptHeaderV5({ region, totalCount, imminentCount, cat, sido, activeTab }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();

  const setTab = (tab: string) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    if (tab === 'all') next.delete('tab');
    else next.set('tab', tab);
    router.replace(`/apt?${next.toString()}`, { scroll: false });
  };

  const tabs: Array<{ key: string; label: string; count: number; warn?: boolean }> = [
    { key: 'all', label: '전체', count: cat.total },
    { key: 'ongoing', label: '분양중', count: cat.ongoing },
    { key: 'imminent', label: '⏰ D-7', count: imminentCount, warn: true },
    { key: 'unsold', label: '미분양', count: cat.unsold },
    { key: 'redev', label: '재개발', count: cat.redev },
    { key: 'trade', label: '실거래', count: cat.trade },
  ];

  return (
    <>
      <section style={{ background: 'var(--bg-elevated, #1f2028)', border: '0.5px solid var(--border, #2a2b35)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '0.5px solid var(--border, #2a2b35)' }}>
          <button
            onClick={() => setOpen(true)}
            aria-label="지역 선택"
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: '0.5px solid var(--border-strong, #3a3b45)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
          >
            <span aria-hidden style={{ flexShrink: 0, opacity: 0.6 }}>📍</span>
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{region}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>{totalCount.toLocaleString()}</span>
          </button>
          <Link href="/apt/search" aria-label="검색" style={{ width: 36, height: 36, borderRadius: 10, border: '0.5px solid var(--border, #2a2b35)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>🔍</Link>
          <Link href="/apt/map" aria-label="지도" style={{ width: 36, height: 36, borderRadius: 10, border: '0.5px solid var(--border, #2a2b35)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>🗺</Link>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 4, padding: '8px 12px', minWidth: 'max-content' }}>
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 999,
                    border: '0.5px solid ' + (active ? 'var(--text-primary, #fff)' : 'var(--border, #2a2b35)'),
                    background: active ? 'var(--text-primary, #fff)' : 'transparent',
                    color: active ? 'var(--bg-base, #0d0e14)' : (t.warn ? '#fbbf24' : 'var(--text-primary, #fff)'),
                    fontSize: 12,
                    fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{t.count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {open && <RegionSheetV5 onClose={() => setOpen(false)} sido={sido} currentRegion={region} />}
    </>
  );
}
