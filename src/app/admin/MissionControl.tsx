'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { C, SECTIONS, type Section } from './admin-shared';

// Dynamic imports — each section loads only when selected
const DashboardSection = dynamic(() => import('./sections/dashboard'), { loading: () => <Spin /> });
const AnalyticsSection = dynamic(() => import('./sections/analytics'), { loading: () => <Spin /> });
const SEOSection = dynamic(() => import('./sections/seo'), { loading: () => <Spin /> });
const UsersSection = dynamic(() => import('./sections/users'), { loading: () => <Spin /> });
const ContentSection = dynamic(() => import('./sections/content'), { loading: () => <Spin /> });
const BlogSection = dynamic(() => import('./sections/blog'), { loading: () => <Spin /> });
const RealEstateSection = dynamic(() => import('./sections/realestate'), { loading: () => <Spin /> });
const SystemSection = dynamic(() => import('./sections/system'), { loading: () => <Spin /> });
const ReportsSection = dynamic(() => import('./sections/reports'), { loading: () => <Spin /> });
const NoticesSection = dynamic(() => import('./sections/notices'), { loading: () => <Spin /> });
const ShopSection = dynamic(() => import('./sections/shop'), { loading: () => <Spin /> });
const GodModeSection = dynamic(() => import('./sections/godmode'), { loading: () => <Spin /> });
const SatelliteSection = dynamic(() => import('./sections/satellite'), { loading: () => <Spin /> });
const PopupsSection = dynamic(() => import('./sections/popups'), { loading: () => <Spin /> });

function Spin() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.brand, borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
    </div>
  );
}

const SECTION_MAP: Record<Section, React.ComponentType> = {
  dashboard: DashboardSection,
  analytics: AnalyticsSection,
  seo: SEOSection,
  users: UsersSection,
  content: ContentSection,
  blog: BlogSection,
  realestate: RealEstateSection,
  system: SystemSection,
  reports: ReportsSection,
  notices: NoticesSection,
  shop: ShopSection,
  godmode: GodModeSection,
  satellite: SatelliteSection,
  popups: PopupsSection,
};

export default function MissionControl() {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ActiveSection = SECTION_MAP[section];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }

        /* ── 모바일 반응형 (태블릿) ── */
        @media (max-width: 768px) {
          .admin-mobile-bar { display: flex !important; }
          .admin-sidebar {
            position: fixed !important; left: -240px; top: 0; z-index: 95;
            height: 100vh !important; width: 220px !important;
            transition: left 0.25s ease; box-shadow: none;
          }
          .admin-sidebar.open { left: 0 !important; box-shadow: 4px 0 24px rgba(0,0,0,0.4); }
          .admin-sidebar-overlay { display: block !important; }
          .admin-main { padding: 56px 12px 32px !important; max-width: 100% !important; }
          .mc-g2 { grid-template-columns: 1fr !important; }
          .mc-g4, .mc-g6 { grid-template-columns: repeat(2, 1fr) !important; }
          .mc-g3 { grid-template-columns: 1fr 1fr !important; }

          /* 공유 컴포넌트 모바일 조정 */
          .admin-table-wrap { font-size: 12px !important; }
          .admin-table-wrap th, .admin-table-wrap td { padding: 8px 8px !important; }
          .admin-detail-grid { grid-template-columns: 1fr !important; }
        }

        /* ── 모바일 반응형 (스마트폰) ── */
        @media (max-width: 480px) {
          .admin-main { padding: 50px 8px 24px !important; }
          .mc-g2, .mc-g3, .mc-g4, .mc-g6 { grid-template-columns: 1fr !important; gap: 6px !important; }

          /* KPICard / StatBox 간격 축소 */
          .admin-main [class*="kpi"], .admin-main > div > div { }
        }
      `}</style>

      {/* 모바일 오버레이 */}
      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />}

      {/* 모바일 상단 바 */}
      <div className="admin-mobile-bar" style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80, background: 'rgba(11,20,37,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: '0 16px', height: 48, borderBottom: `1px solid ${C.border}`, alignItems: 'center', justifyContent: 'space-between' }}>
        <button aria-label="메뉴" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: C.text, fontSize: 18, cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>{sidebarOpen ? '✕' : '☰'}</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1, textAlign: 'center' }}>{SECTIONS.find(s => s.key === section)?.icon} {SECTIONS.find(s => s.key === section)?.label}</span>
        <span style={{ fontSize: 10, color: C.brand, fontWeight: 600 }}>MC</span>
      </div>

      {/* 사이드바 */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 200, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '12px 6px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.brand, padding: '6px 12px 12px', letterSpacing: '-0.02em', borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>⚡ Mission Control</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {SECTIONS.map(s => (
            <button key={s.key} data-section={s.key} onClick={() => { setSection(s.key); setSidebarOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', width: '100%',
              background: section === s.key ? C.brandBg : 'transparent',
              color: section === s.key ? C.brand : C.textSec,
              fontWeight: section === s.key ? 700 : 500, fontSize: 12, textAlign: 'left', transition: 'all 0.12s',
            }}>
              <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{s.icon}</span>{s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="admin-main" style={{ flex: 1, padding: '20px 24px 40px', maxWidth: 1100, minWidth: 0 }}>
        <ActiveSection />
      </main>
    </div>
  );
}
