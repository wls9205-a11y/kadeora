// s220 메인 v5: MainLayout — sticky brand header + 지역 chips (server)
import RegionFilterChips from './RegionFilterChips';
import type { MainRegion } from './types';

interface Props {
  activeRegion: MainRegion;
  children: React.ReactNode;
}

export default function MainLayout({ activeRegion, children }: Props) {
  const nowLabel = new Date().toLocaleString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '0 16px',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--bg-base)',
          borderBottom: '0.5px solid var(--border)',
          margin: '0 -16px',
          padding: '0 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 44,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ letterSpacing: '-0.5px' }}>
            카더라 <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 4 }}>v5</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{nowLabel}</span>
        </div>
        <RegionFilterChips activeRegion={activeRegion} />
      </div>
      <main style={{ paddingTop: 12, paddingBottom: 80 }}>{children}</main>
    </div>
  );
}
