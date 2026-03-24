'use client';
import dynamic from 'next/dynamic';

const ControlTower = dynamic(() => import('./ControlTower'), {
  ssr: false,
  loading: () => <Loading text="컨트롤 타워 로딩..." />,
});
const AdminSites = dynamic(() => import('./AdminSites'), {
  ssr: false,
  loading: () => <Loading text="현장 허브 로딩..." />,
});

function Loading({ text }: { text: string }) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #1E2D4520', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin .6s linear infinite', margin: '0 auto 10px' }} />
      <div style={{ color: '#7D8DA3', fontSize: 12 }}>{text}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function AdminHub() {
  return (
    <div style={{ minHeight: '100vh', background: '#050A18' }}>
      {/* 컨트롤 타워 — 갓버튼 + KPI + 시스템 헬스 */}
      <ControlTower />

      {/* 구분선 */}
      <div style={{ height: 1, background: '#1E2D45', margin: '0 20px' }} />

      {/* 현장 관리 허브 — SEO 현장 + 관심고객 */}
      <div style={{ padding: 20 }}>
        <AdminSites />
      </div>
    </div>
  );
}
