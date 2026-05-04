'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface QuickFiltersState {
  region: string;
  sigungu: string | null;
  category?: string;
  price?: string;  // '0-3' | '3-6' | '6-10' | '10-20' | '20+'
  size?: string;   // '59' | '84' | '105+'
  builder?: string;
}

interface Props {
  filters: QuickFiltersState;
  // 해당 region 의 상위 시공사 (page.tsx 가 server-side fetch 해서 전달)
  topBuilders?: { builder: string; count: number }[];
}

const PRICE_BANDS: { value: string; label: string }[] = [
  { value: '0-3', label: '~3억' },
  { value: '3-6', label: '3-6억' },
  { value: '6-10', label: '6-10억' },
  { value: '10-20', label: '10-20억' },
  { value: '20+', label: '20억+' },
];

const SIZE_BANDS: { value: string; label: string }[] = [
  { value: '59', label: '59㎡' },
  { value: '84', label: '84㎡' },
  { value: '105+', label: '105㎡+' },
];

function buildHref(f: QuickFiltersState, override: Partial<QuickFiltersState>): string {
  const next = { ...f, ...override };
  const params = new URLSearchParams();
  params.set('region', next.region);
  if (next.sigungu) params.set('sigungu', next.sigungu);
  if (next.category && next.category !== 'all') params.set('category', next.category);
  if (next.price) params.set('price', next.price);
  if (next.size) params.set('size', next.size);
  if (next.builder) params.set('builder', next.builder);
  return `/apt?${params.toString()}`;
}

export default function AptQuickFilters({ filters, topBuilders }: Props) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  const toggleFilter = (key: 'price' | 'size' | 'builder', value: string) => {
    const current = filters[key];
    const nextValue = current === value ? undefined : value;
    router.replace(buildHref(filters, { [key]: nextValue } as Partial<QuickFiltersState>));
  };

  const hasAny = !!(filters.price || filters.size || filters.builder);

  return (
    <section
      aria-label="빠른 필터"
      style={{
        maxWidth: 720, margin: '8px auto 0',
        padding: '0 var(--sp-lg)',
      }}
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 0', background: 'transparent', border: 'none',
          fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer',
        }}
      >
        <span aria-hidden>🔧</span>
        <span>필터</span>
        {hasAny && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            padding: '1px 6px', borderRadius: 999,
            background: 'var(--brand)', color: 'var(--text-inverse, #fff)',
          }}>
            {[filters.price, filters.size, filters.builder].filter(Boolean).length}
          </span>
        )}
        <span style={{ marginLeft: 4, transition: 'transform var(--transition-fast)', display: 'inline-block', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
          {/* 가격대 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 5, letterSpacing: 1 }}>가격대</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {PRICE_BANDS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => toggleFilter('price', b.value)}
                  aria-pressed={filters.price === b.value}
                  style={pillStyle(filters.price === b.value)}
                >{b.label}</button>
              ))}
            </div>
          </div>

          {/* 평형 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 5, letterSpacing: 1 }}>평형</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {SIZE_BANDS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => toggleFilter('size', b.value)}
                  aria-pressed={filters.size === b.value}
                  style={pillStyle(filters.size === b.value)}
                >{b.label}</button>
              ))}
            </div>
          </div>

          {/* 시공사 */}
          {topBuilders && topBuilders.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 5, letterSpacing: 1 }}>{filters.region} 주요 시공사</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {topBuilders.slice(0, 5).map((b) => (
                  <button
                    key={b.builder}
                    onClick={() => toggleFilter('builder', b.builder)}
                    aria-pressed={filters.builder === b.builder}
                    style={pillStyle(filters.builder === b.builder)}
                  >
                    {b.builder} <span style={{ opacity: 0.65 }}>({b.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 999,
    fontSize: 12, fontWeight: 700,
    background: active ? 'var(--brand)' : 'var(--bg-hover)',
    color: active ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)',
    border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
    cursor: 'pointer',
    transition: 'background var(--transition-fast), color var(--transition-fast)',
  };
}
