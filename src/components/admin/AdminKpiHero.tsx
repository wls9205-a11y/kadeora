import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function getKpis() {
  try {
    const sb = getSupabaseAdmin();

    const [totalRes, todayRes, popupRes] = await Promise.all([
      (sb as any).from('profiles').select('*', { count: 'exact', head: true }),
      (sb as any).from('v_admin_dashboard_v2').select('signups, pv, cta_views, cta_clicks').limit(1),
      (sb as any).from('v_admin_cta_performance_24h')
        .select('views, clicks, ctr_pct')
        .eq('cta_name', 'popup_signup_modal')
        .maybeSingle(),
    ]);

    const t = (todayRes.data?.[0] as any) || { signups: 0, pv: 0, cta_views: 0, cta_clicks: 0 };
    const p = (popupRes.data as any) || { views: 0, clicks: 0, ctr_pct: 0 };

    return {
      totalUsers: totalRes.count || 0,
      todaySignups: t.signups || 0,
      todayPv: t.pv || 0,
      overallCtr: t.cta_views > 0 ? ((t.cta_clicks / t.cta_views) * 100).toFixed(1) : '0',
      popupCtr: Number(p.ctr_pct) || 0,
      popupViews: p.views || 0,
    };
  } catch {
    return { totalUsers: 0, todaySignups: 0, todayPv: 0, overallCtr: '0', popupCtr: 0, popupViews: 0 };
  }
}

export default async function AdminKpiHero() {
  const kpis = await getKpis();
  const popupColor = kpis.popupCtr >= 5 ? '#4ade80' : kpis.popupCtr >= 1 ? '#FEE500' : '#f87171';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: 10, marginBottom: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,123,246,0.15) 0%, rgba(59,123,246,0.04) 100%)',
        border: '1px solid rgba(59,123,246,0.3)',
        padding: '16px 18px', borderRadius: 12,
        gridColumn: 'span 2',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6, letterSpacing: '0.02em' }}>
          총 가입자
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {kpis.totalUsers.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: kpis.todaySignups > 0 ? '#4ade80' : '#f87171', marginTop: 8 }}>
          {kpis.todaySignups > 0 ? `+${kpis.todaySignups} 오늘` : '🚨 오늘 0건'}
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 16px', borderRadius: 12,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>오늘 PV</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {kpis.todayPv.toLocaleString()}
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 16px', borderRadius: 12,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>전체 CTR</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {kpis.overallCtr}%
        </div>
      </div>

      <div style={{
        background: kpis.popupCtr >= 5 ? 'rgba(34,197,94,0.08)' : 'rgba(254,229,0,0.08)',
        border: `1px solid ${kpis.popupCtr >= 5 ? 'rgba(34,197,94,0.3)' : 'rgba(254,229,0,0.25)'}`,
        padding: '14px 16px', borderRadius: 12,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
          팝업 CTR ({kpis.popupViews}view)
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: popupColor, fontVariantNumeric: 'tabular-nums' }}>
          {kpis.popupCtr}%
        </div>
      </div>
    </div>
  );
}
