// s218: 가입 funnel 시각화 — visit → cta_view → cta_click → oauth_start → oauth_callback → signup → onboarded
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface FunnelRow {
  step: string;
  step_order: number;
  count: number;
  conv_from_prev: number | null;
}

const STEP_LABEL: Record<string, string> = {
  visit:           '방문 (UV)',
  cta_view:        'CTA 노출',
  cta_click:       'CTA 클릭',
  oauth_start:     'OAuth 시작',
  oauth_callback:  'OAuth 콜백',
  signup_complete: '가입 완료',
  onboarded:       '온보딩 완료',
};

function dropTone(conv: number | null): string {
  if (conv === null) return 'var(--text-tertiary, #888)';
  if (conv >= 50) return '#22c55e';
  if (conv >= 10) return '#fbbf24';
  return '#ef4444';
}

export default async function SignupFunnel({ windowDays = 7 }: { windowDays?: number }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('admin_signup_funnel', { window_days: windowDays });
  if (error || !data) {
    return (
      <section aria-label="가입 퍼널" style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
        Funnel 로드 실패
      </section>
    );
  }
  const rows = (data as FunnelRow[]).slice().sort((a, b) => a.step_order - b.step_order);
  const max = Math.max(...rows.map((r) => Number(r.count) || 0), 1);

  // 가장 큰 drop 지점 식별 (conv_from_prev 가장 낮은 단계)
  let worstIdx = -1;
  let worstConv = 100;
  rows.forEach((r, i) => {
    if (i === 0) return;
    const c = r.conv_from_prev === null ? null : Number(r.conv_from_prev);
    if (c !== null && c < worstConv) { worstConv = c; worstIdx = i; }
  });

  return (
    <section aria-label="가입 퍼널" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary, #fff)' }}>
        🚪 가입 퍼널 ({windowDays}일)
      </h2>
      <div
        style={{
          padding: 14,
          background: 'var(--bg-elevated, #1f2028)',
          border: '1px solid var(--border, #2a2b35)',
          borderRadius: 'var(--radius-md, 10px)',
        }}
      >
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => {
            const count = Number(r.count) || 0;
            const conv = r.conv_from_prev === null ? null : Number(r.conv_from_prev);
            const widthPct = Math.round((count / max) * 100);
            const isWorst = i === worstIdx;
            return (
              <li key={r.step} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, wordBreak: 'keep-all' }}>
                <div style={{
                  flex: '0 0 110px', color: 'var(--text-secondary, #aaa)', fontWeight: 600,
                }}>
                  {STEP_LABEL[r.step] || r.step}
                </div>
                <div style={{ flex: 1, position: 'relative', height: 26 }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: isWorst
                        ? 'linear-gradient(90deg, rgba(239,68,68,0.35), rgba(239,68,68,0.15))'
                        : 'linear-gradient(90deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))',
                      border: `1px solid ${isWorst ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.4)'}`,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 8,
                      color: 'var(--text-primary, #fff)',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {count.toLocaleString()}
                  </div>
                </div>
                <div
                  style={{
                    flex: '0 0 70px', textAlign: 'right',
                    color: dropTone(conv), fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    fontSize: 11,
                  }}
                  aria-label={i === 0 ? '시작 단계' : `이전 대비 ${conv ?? 0}%`}
                >
                  {i === 0 ? '—' : conv === null ? '—' : `${conv.toFixed(1)}%`}
                </div>
              </li>
            );
          })}
        </ol>
        {worstIdx > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
            ⚠️ 최대 drop: {STEP_LABEL[rows[worstIdx - 1].step]} → {STEP_LABEL[rows[worstIdx].step]} ({worstConv.toFixed(1)}%)
          </div>
        )}
      </div>
    </section>
  );
}
