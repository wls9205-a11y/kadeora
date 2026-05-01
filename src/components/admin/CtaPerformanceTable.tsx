// s218: CTA 30d 성능 비교 표 — apt_alert_cta CTR 0.17% 같은 product 문제 식별용
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface CtaRow {
  cta_name: string;
  views: number;
  clicks: number;
  dismisses: number;
  ctr_pct: number | null;
  last_event: string | null;
}

function ctrTone(ctr: number | null): string {
  if (ctr === null) return 'var(--text-tertiary, #888)';
  if (ctr >= 5) return '#22c55e';   // 좋음
  if (ctr >= 1) return '#fbbf24';   // 평범
  return '#ef4444';                 // 의심
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffH = Math.round((now - d.getTime()) / 3600000);
    if (diffH < 1) return '방금';
    if (diffH < 24) return `${diffH}시간 전`;
    return `${Math.round(diffH / 24)}일 전`;
  } catch { return '—'; }
}

export default async function CtaPerformanceTable({ windowDays = 30 }: { windowDays?: number }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('admin_cta_performance', { window_days: windowDays });
  if (error || !data) {
    return (
      <section aria-label="CTA 성능" style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
        CTA 성능 로드 실패
      </section>
    );
  }
  const rows = data as CtaRow[];

  return (
    <section aria-label="CTA 성능 비교" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary, #fff)' }}>
        📊 CTA 성능 ({windowDays}일, {rows.length}개)
      </h2>
      <div
        style={{
          background: 'var(--bg-elevated, #1f2028)',
          border: '1px solid var(--border, #2a2b35)',
          borderRadius: 'var(--radius-md, 10px)',
          overflow: 'hidden',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 540 }}>
          <thead style={{ background: 'var(--bg-hover, #2a2b35)' }}>
            <tr>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>CTA</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>View</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Click</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>CTR</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>최근</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ctr = r.ctr_pct === null ? null : Number(r.ctr_pct);
              return (
                <tr key={r.cta_name} style={{ borderTop: '1px solid var(--border, #2a2b35)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-primary, #fff)', wordBreak: 'break-all' }}>
                    {r.cta_name}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(r.views).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(r.clicks).toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px', textAlign: 'right', fontWeight: 700,
                      color: ctrTone(ctr),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {ctr === null ? '—' : `${ctr.toFixed(2)}%`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {fmtTime(r.last_event)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
        🟢 ≥5% 좋음 · 🟡 1-5% 평범 · 🔴 &lt;1% 의심 (UI/카피 점검 필요)
      </div>
    </section>
  );
}
