// s220 메인 v5: RegionFilterChips — 가로 스크롤 18 chip 지역 필터 (server)
import Link from 'next/link';
import { MAIN_REGION_LIST, MAIN_REGION_LABELS, type MainRegion } from './types';

interface Props {
  activeRegion: MainRegion;
}

export default function RegionFilterChips({ activeRegion }: Props) {
  return (
    <nav
      aria-label="지역 필터"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        padding: '8px 0',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>{`nav[aria-label="지역 필터"]::-webkit-scrollbar{display:none}`}</style>
      {MAIN_REGION_LIST.map((r) => {
        const isActive = r === activeRegion;
        return (
          <Link
            key={r}
            href={r === 'busan' ? '/' : `/?region=${r}`}
            prefetch={false}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              padding: '0 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#fff' : 'var(--text-primary)',
              background: isActive ? 'var(--brand)' : 'var(--bg-surface)',
              border: `0.5px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {MAIN_REGION_LABELS[r]}
          </Link>
        );
      })}
    </nav>
  );
}
