'use client';

import { useRouter } from 'next/navigation';

export type AptCategory = 'all' | 'subscription' | 'imminent_d7' | 'unsold' | 'redev' | 'trade';

interface TabDef {
  key: AptCategory;
  label: string;
  emoji: string;
}

const TABS: TabDef[] = [
  { key: 'all',          label: '전체',     emoji: '' },
  { key: 'subscription', label: '분양중',   emoji: '🏗️' },
  { key: 'imminent_d7',  label: '임박 D-7', emoji: '⏰' },
  { key: 'unsold',       label: '미분양',   emoji: '📉' },
  { key: 'redev',        label: '재개발',   emoji: '🏚️' },
  { key: 'trade',        label: '실거래',   emoji: '📊' },
];

interface Props {
  current: AptCategory;
  region: string;
  sigungu: string | null;
  // 우측 상단에 표시할 부가 정보 (각 카테고리 카운트 등) — 옵션
  countByCategory?: Partial<Record<AptCategory, number>>;
}

function buildHref(cat: AptCategory, region: string, sigungu: string | null, search: { price?: string; size?: string; builder?: string } = {}) {
  const params = new URLSearchParams();
  params.set('region', region);
  if (sigungu) params.set('sigungu', sigungu);
  if (cat !== 'all') params.set('category', cat);
  if (search.price) params.set('price', search.price);
  if (search.size) params.set('size', search.size);
  if (search.builder) params.set('builder', search.builder);
  return `/apt?${params.toString()}`;
}

export default function AptCategoryTabs({ current, region, sigungu, countByCategory }: Props) {
  const router = useRouter();
  const onClick = (cat: AptCategory) => {
    router.replace(buildHref(cat, region, sigungu));
  };

  return (
    <nav
      aria-label="아파트 카테고리"
      style={{
        position: 'sticky', top: 86, zIndex: 40,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 0',
      }}
    >
      <div
        style={{
          display: 'flex', gap: 4, overflowX: 'auto',
          padding: '0 var(--sp-lg)',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
        }}
        className="apt-cat-scroll"
      >
        {TABS.map((t) => {
          const active = t.key === current;
          const count = countByCategory?.[t.key];
          return (
            <button
              key={t.key}
              onClick={() => onClick(t.key)}
              aria-current={active ? 'page' : undefined}
              style={{
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: active ? 800 : 600,
                background: active ? 'var(--brand)' : 'var(--bg-hover)',
                color: active ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              {t.emoji && <span aria-hidden>{t.emoji}</span>}
              <span>{t.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 999,
                  background: active ? 'rgba(255,255,255,0.22)' : 'var(--bg-base)',
                  color: active ? 'var(--text-inverse, #fff)' : 'var(--text-tertiary)',
                }}>
                  {count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <style>{`.apt-cat-scroll::-webkit-scrollbar { display: none; }`}</style>
    </nav>
  );
}
