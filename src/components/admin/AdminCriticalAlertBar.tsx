import { getSupabaseAdmin } from '@/lib/supabase-admin';

type AlertItem = { severity: string; message: string; key?: string };

async function getCriticalCount() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('v_admin_action_items_v2')
      .select('severity, message, key')
      .eq('severity', 'red');
    return { count: data?.length || 0, items: (data as AlertItem[]) || [] };
  } catch {
    return { count: 0, items: [] as AlertItem[] };
  }
}

export default async function AdminCriticalAlertBar() {
  const { count, items } = await getCriticalCount();

  if (count === 0) {
    return (
      <div style={{
        padding: '14px 18px', borderRadius: 10, marginBottom: 16,
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>
          긴급 액션 없음 — 모든 시스템 정상
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10, marginBottom: 16,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 10, height: 10, background: '#ef4444', borderRadius: '50%',
          animation: 'kd-admin-pulse 2s infinite',
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>
          🚨 긴급 액션 ({count}건)
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.slice(0, 3).map((it, i) => (
          <div key={it.key || `${i}-${it.message}`} style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            · {it.message}
          </div>
        ))}
        {count > 3 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            ...외 {count - 3}건 더
          </div>
        )}
      </div>
      <style>{`
        @keyframes kd-admin-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
