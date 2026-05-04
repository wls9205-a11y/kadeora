// s224 — admin 페이지 최상단 긴급 알림 (broken_cta / cron_failures / no_signups / score_drop)
// RPC admin_critical_alerts 호출. alerts 0건이면 null 반환 (자리 차지 X).
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
              background: isCritical ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)',
              border: `1px solid ${isCritical ? 'rgba(239,68,68,0.5)' : 'rgba(251,191,36,0.5)'}`,
              borderRadius: 8, textDecoration: 'none',
              animation: isCritical ? 'kd-critical-pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            <span style={{ fontSize: 16 }}>{isCritical ? '🚨' : '⚠️'}</span>
            <strong style={{ fontSize: 13, color: isCritical ? '#ef4444' : '#fbbf24', fontWeight: 800 }}>
              {a.title}
            </strong>
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
              {a.detail}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary, #888)' }}>→</span>
          </a>
        );
      })}
      <style>{`@keyframes kd-critical-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.7 } }`}</style>
    </section>
  );
}
