// s224 — admin 페이지 최상단 긴급 알림
// RPC admin_critical_alerts 호출. alerts 0건이면 null 반환 (자리 차지 X).
//
// [S10-2] 이 컴포넌트는 구조를 바꾸지 않는다.
//   RPC 하나만 계속 호출한다 — DB 쪽(admin_critical_alerts)이 살아있는 critical급
//   admin_alerts 를 타입별 집계 1줄로 합쳐 내려주므로, 여기에 새 API 를 붙이면
//   같은 것을 두 경로로 세게 된다. 컴포넌트 계약 {severity, code, title, detail, href} 은 그대로.
//   S10-2 에서 한 일은 하드코딩 색을 토큰으로 바꾼 것뿐이다
//   (#fbbf24·rgba(239,68,68,…) 는 다크 시절 잔재라 라이트 배경에서 대비가 맞지 않았다).
//   href 로 /admin/alerts 가 내려오는 항목이 생겼고, 그 페이지는 S10-2 에서 신설했다.
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Alert {
  severity: 'critical' | 'warning';
  code: string;
  title: string;
  detail: string;
  href?: string;
}

export default async function CriticalAlertBar() {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).rpc('admin_critical_alerts');
  const alerts: Alert[] = data?.alerts ?? [];
  if (alerts.length === 0) return null;

  return (
    <section aria-label="긴급 알림" style={{ marginBottom: 14 }}>
      {alerts.map((a, i) => {
        const isCritical = a.severity === 'critical';
        return (
          <a
            key={i}
            href={a.href ?? '#'}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', marginBottom: 6,
              background: isCritical ? 'var(--accent-red-bg)' : 'var(--warning-bg)',
              border: `1px solid ${isCritical ? 'var(--accent-red)' : 'var(--warning)'}`,
              borderRadius: 'var(--radius-sm)', textDecoration: 'none',
              animation: isCritical ? 'kd-critical-pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            <span style={{ fontSize: 16 }}>{isCritical ? '🚨' : '⚠️'}</span>
            <strong style={{ fontSize: 13, color: isCritical ? 'var(--accent-red)' : 'var(--warning)', fontWeight: 800 }}>
              {a.title}
            </strong>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {a.detail}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
          </a>
        );
      })}
      <style>{`@keyframes kd-critical-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.7 } }`}</style>
    </section>
  );
}
