import AdminShellV4 from './v4/AdminShellV4';
import CriticalAlertBar from '@/components/admin/CriticalAlertBar';
import CronUnifiedPanel from '@/components/admin/CronUnifiedPanel';
import NorthStarCard from '@/components/admin/NorthStarCard';
import CtaPerformanceTable from '@/components/admin/CtaPerformanceTable';
import AbExperimentViewer from '@/components/admin/AbExperimentViewer';
import AptCoverUploader from '@/components/admin/AptCoverUploader';

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
      {/* v5-V4: 조감도 업로드. hero_image_url 0건은 정책이 아니라 넣을 화면이 없어서였다. */}
      <AptCoverUploader />

      {/* ADDENDUM §2 — 손으로 들어가는 문. 링크가 없으면 URL 을 아는 사람만 쓰게 된다.
          검수 큐는 아무도 안 열면 존재하지 않는 것과 같다. */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href="/admin/redev-review" style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
          정비사업 공시 검수 →
        </a>
        <a href="/admin/apt-stage" style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
          현장 단계 한 줄 입력 →
        </a>
      </div>
      <div style={{ marginTop: 16 }}>
        <CronUnifiedPanel />
      </div>
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>참조 데이터</h2>
        <NorthStarCard />
        <CtaPerformanceTable windowDays={30} />
        <AbExperimentViewer windowDays={14} />
      </div>
    </div>
  );
}
