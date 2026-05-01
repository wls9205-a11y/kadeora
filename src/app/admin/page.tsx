import AdminShellV4 from './v4/AdminShellV4';
import NorthStarCard from '@/components/admin/NorthStarCard';
import CtaPerformanceTable from '@/components/admin/CtaPerformanceTable';
import SignupFunnel from '@/components/admin/SignupFunnel';
import AbExperimentViewer from '@/components/admin/AbExperimentViewer';

export const dynamic = 'force-dynamic';
export const metadata = { title: '미션 컨트롤 — 카더라' };

// s218: North Star + CTA 성능 + 가입 퍼널 server component 들 상단에 추가.
// s222: A/B 실험 viewer 추가.
// AdminShellV4 (client) 는 그대로 보존 (회귀 X).
export default function AdminPage() {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)' }}>
      <NorthStarCard />
      <CtaPerformanceTable windowDays={30} />
      <SignupFunnel windowDays={7} />
      <AbExperimentViewer windowDays={14} />
      <AdminShellV4 />
    </div>
  );
}
