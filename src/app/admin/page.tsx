import AdminCriticalAlertBar from '@/components/admin/AdminCriticalAlertBar';
import AdminKpiHero from '@/components/admin/AdminKpiHero';
import AdminWhaleExportCard from '@/components/admin/AdminWhaleExportCard';
import AdminCtaSignals from '@/components/admin/AdminCtaSignals';
import AdminShellWrapper from './AdminShellWrapper';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
          어드민 대시보드
        </h1>

        <AdminCriticalAlertBar />
        <AdminKpiHero />
        <AdminWhaleExportCard />
        <AdminCtaSignals />
      </div>

      {/* 기존 탭 기반 어드민 셸 — 회귀 방지 */}
      <AdminShellWrapper />
    </div>
  );
}
