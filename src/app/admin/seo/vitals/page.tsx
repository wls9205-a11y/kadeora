/**
 * 세션 150 D — CLS 범인 TOP + LCP 엘리먼트 대시보드.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VitalsAdminPage() {
  const sb = getSupabaseAdmin();
  const [clsRows, lcpRows, p75Rows] = await Promise.all([
    (sb as any)
      .from('web_vitals')
      .select('page_path, cls_largest_shift_target, cls_largest_shift_value, value, created_at')
      .eq('metric_name', 'CLS')
      .not('cls_largest_shift_target', 'is', null)
      .order('cls_largest_shift_value', { ascending: false })
      .limit(30),
    (sb as any)
      .from('web_vitals')
      .select('page_path, lcp_element, value')
      .eq('metric_name', 'LCP')
      .not('lcp_element', 'is', null)
      .order('value', { ascending: false })
      .limit(20),
    (sb as any).rpc('web_vitals_p75_by_metric').catch(() => ({ data: null })),
  ]);

  const td = { padding: 8, borderTop: '1px solid var(--border)' } as const;

  return (
    <div style={{ padding: 24, color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Web Vitals — CLS 범인</h1>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            <th style={td}>path</th>
            <th style={td}>selector</th>
            <th style={td}>shift</th>
            <th style={td}>CLS</th>
          </tr>
        </thead>
        <tbody>
          {(clsRows.data || []).map((r: any, i: number) => (
            <tr key={i}>
              <td style={td}>{decodeURIComponent(r.page_path || '')}</td>
              <td style={td}><code>{r.cls_largest_shift_target}</code></td>
              <td style={td}>{r.cls_largest_shift_value}</td>
              <td style={td}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 12px' }}>LCP 엘리먼트 TOP</h2>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            <th style={td}>path</th>
            <th style={td}>selector</th>
            <th style={td}>LCP (ms)</th>
          </tr>
        </thead>
        <tbody>
          {(lcpRows.data || []).map((r: any, i: number) => (
            <tr key={i}>
              <td style={td}>{decodeURIComponent(r.page_path || '')}</td>
              <td style={td}><code>{r.lcp_element}</code></td>
              <td style={td}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
