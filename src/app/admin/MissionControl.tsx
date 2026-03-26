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
const GodModeSection = dynamic(() => import('./sections/godmode'), { loading: () => <Spin /> });

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
  godmode: GodModeSection,
};

export default function MissionControl() {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const ActiveSection = SECTION_MAP[section];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />}

      <div className="admin-mobile-bar" style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80, background: C.surface, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{SECTIONS.find(s => s.key === section)?.icon} {SECTIONS.find(s => s.key === section)?.label}</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: C.text, fontSize: 20, cursor: 'pointer' }}>{sidebarOpen ? '✕' : '☰'}</button>
      </div>

      <aside className="admin-sidebar" style={{ width: 200, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '16px 8px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.brand, padding: '4px 12px 16px', letterSpacing: '-0.02em' }}>Mission Control</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => { setSection(s.key); if (typeof window !== 'undefined' && window.innerWidth < 769) setSidebarOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: section === s.key ? C.brandBg : 'transparent',
              color: section === s.key ? C.brand : C.textSec,
              fontWeight: section === s.key ? 700 : 500, fontSize: 13, textAlign: 'left', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>{s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, padding: '20px 24px 40px', maxWidth: 1100, minWidth: 0 }}>
        <ActiveSection />
      </main>
    </div>
  );
}
