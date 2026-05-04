import AdminShellV4 from './v4/AdminShellV4';
import CriticalAlertBar from '@/components/admin/CriticalAlertBar';
import CronUnifiedPanel from '@/components/admin/CronUnifiedPanel';
import NorthStarCard from '@/components/admin/NorthStarCard';
import CtaPerformanceTable from '@/components/admin/CtaPerformanceTable';
import AbExperimentViewer from '@/components/admin/AbExperimentViewer';

export const dynamic = 'force-dynamic';
export const metadata = { title: '미션 컨트롤 — 카더라' };

// s224: V5 정보 위계
//   1. CriticalAlertBar (긴급 — 항상 최상단)
//   2. AdminShellV4 (sticky 헤더 + 가입/CTA/Ops/Content/Users/Traffic — V4 그대로)
//   3. CronUnifiedPanel (cron 통합 — 접힘 기본)
//   4. NorthStarCard, CtaPerformanceTable, AbExperimentViewer (참조)
// s218 SignupFunnel 제거 — V4 SignupCTASection funnel 과 통합
// GodMode 카테고리 실행은 s225 에서 dry-run + audit log 설계 후 별도 진행
export default function AdminPage() {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)' }}>
      <CriticalAlertBar />
      <AdminShellV4 />
      <div style={{ marginTop: 16 }}>
        <CronUnifiedPanel />
      </div>
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border, #2a2b35)' }}>
        <h2 style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>참조 데이터</h2>
        <NorthStarCard />
        <CtaPerformanceTable windowDays={30} />
        <AbExperimentViewer windowDays={14} />
      </div>
    </div>
  );
}
