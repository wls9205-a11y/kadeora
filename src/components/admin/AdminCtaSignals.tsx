import { getSupabaseAdmin } from '@/lib/supabase-admin';

type CtaRow = {
  cta_name: string;
  views: number;
  clicks: number;
  ctr_pct: number;
  verdict: string;
};

const ICON_MAP: Record<string, string> = {
  '✅ 양호': '✅', '🟡 평균': '🟡', '🔴 저조': '🔴',
  '🚨 0% CTR': '🚨', '⏸ 대기': '⏸',
};

const COLOR_MAP: Record<string, string> = {
  '✅ 양호': '#4ade80', '🟡 평균': '#fbbf24', '🔴 저조': '#f87171',
  '🚨 0% CTR': '#ef4444', '⏸ 대기': '#9ca3af',
};

async function getCtaSignals(): Promise<CtaRow[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('v_admin_cta_performance_24h')
      .select('cta_name, views, clicks, ctr_pct, verdict')
      .gte('views', 1)
      .order('views', { ascending: false })
      .limit(10);
    return (data as CtaRow[]) || [];
  } catch {
    return [];
  }
}

export default async function AdminCtaSignals() {
  const signals = await getCtaSignals();
  if (!signals.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>CTA 24h 성능</h3>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>view → click</span>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        {signals.map((s, i) => (
          <div key={s.cta_name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>
              {ICON_MAP[s.verdict] || '·'}
            </span>
            <span style={{
              flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.85)',
              fontFamily: 'ui-monospace, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {s.cta_name}
            </span>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)',
              fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right',
            }}>
              {s.views} / {s.clicks}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              minWidth: 50, textAlign: 'right',
              color: COLOR_MAP[s.verdict] || '#9ca3af',
            }}>
              {s.ctr_pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
