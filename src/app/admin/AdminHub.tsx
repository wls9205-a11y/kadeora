'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// 동적 임포트로 번들 분리
const ControlTower = dynamic(() => import('./ControlTower'), { 
  ssr: false,
  loading: () => <LoadingScreen text="컨트롤 타워 로딩..." />,
});
const AdminCommandCenter = dynamic(() => import('./AdminCommandCenter'), { 
  ssr: false,
  loading: () => <LoadingScreen text="커맨드센터 로딩..." />,
});
const AdminSites = dynamic(() => import('./AdminSites'), { ssr: false });

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#050A18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #1E2D4520', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin .6s linear infinite', margin: '0 auto 14px' }} />
        <div style={{ color: '#7D8DA3', fontSize: 13, fontWeight: 600 }}>{text}</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

type TabId = 'tower' | 'center' | 'sites';

const TABS: { id: TabId; label: string; icon: string; desc: string }[] = [
  { id: 'tower', label: '컨트롤 타워', icon: '⚡', desc: '원버튼 전체 제어' },
  { id: 'center', label: '커맨드센터', icon: '🎛️', desc: '세부 크론 관리' },
  { id: 'sites', label: '현장 관리', icon: '🏗️', desc: 'SEO 현장 허브' },
];

export default function AdminHub() {
  const [activeTab, setActiveTab] = useState<TabId>('tower');
  
  // URL 해시로 탭 상태 유지
  useEffect(() => {
    const hash = window.location.hash.slice(1) as TabId;
    if (hash && TABS.some(t => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);
  
  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050A18' }}>
      {/* 탭 네비게이션 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'linear-gradient(180deg, #050A18 0%, #050A18 80%, transparent 100%)',
        padding: '12px 20px 20px',
      }}>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          background: '#0D1526', padding: 6, borderRadius: 14,
          border: '1px solid #1E2D45',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                flex: 1, minWidth: 120, padding: '12px 16px',
                background: activeTab === tab.id ? 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)' : 'transparent',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all .2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: activeTab === tab.id ? '#FFF' : '#94A3B8',
                }}>{tab.label}</span>
              </div>
              <span style={{
                fontSize: 10,
                color: activeTab === tab.id ? '#93C5FD' : '#64748B',
              }}>{tab.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {activeTab === 'tower' && <ControlTower />}
        {activeTab === 'center' && <AdminCommandCenter healthChecks={[]} />}
        {activeTab === 'sites' && (
          <div style={{ padding: 20 }}>
            <AdminSites />
          </div>
        )}
      </div>
    </div>
  );
}
