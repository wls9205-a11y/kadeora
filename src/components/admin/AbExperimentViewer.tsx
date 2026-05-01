// s222: A/B 실험 결과 표시 — admin 메인에 stack.
// experiments[] 마다 ab_test_significance(name, 14) 호출, 결과 표 1개씩.
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface AbRow {
  variant: string;
  views: number;
  clicks: number;
  ctr_pct: number | null;
  vs_control_pct: number | null;
  significant: boolean | null;
}

interface ExperimentSpec {
  name: string;
  label: string;
}

const KNOWN_EXPERIMENTS: ExperimentSpec[] = [
  { name: 'apt_alert_cta_v2',     label: 'apt_alert_cta 재디자인' },
  { name: 'content_gate_v2',      label: 'content_gate 재디자인' },
  { name: 'blog_early_teaser_v2', label: 'blog_early_teaser 재디자인' },
];

function ctrTone(ctr: number | null): string {
  if (ctr === null) return 'var(--text-tertiary, #888)';
  if (ctr >= 5) return '#22c55e';
  if (ctr >= 1) return '#fbbf24';
  return '#ef4444';
}

function deltaTone(delta: number | null, significant: boolean | null): string {
  if (delta === null || !significant) return 'var(--text-tertiary, #888)';
  if (delta > 0) return '#22c55e';
  if (delta < 0) return '#ef4444';
  return 'var(--text-tertiary, #888)';
}

async function fetchExperiment(sb: ReturnType<typeof getSupabaseAdmin>, name: string): Promise<AbRow[]> {
  try {
    const { data, error } = await (sb as any).rpc('ab_test_significance', { exp_name: name, window_days: 14 });
    if (error) return [];
    return (data || []) as AbRow[];
  } catch { return []; }
}

export default async function AbExperimentViewer({
  experiments = KNOWN_EXPERIMENTS,
  windowDays = 14,
}: {
  experiments?: ExperimentSpec[];
  windowDays?: number;
}) {
  const sb = getSupabaseAdmin();
  const results = await Promise.all(experiments.map((e) => fetchExperiment(sb, e.name).then((rows) => ({ spec: e, rows }))));
  const active = results.filter((r) => r.rows.length > 0);

  if (active.length === 0) {
    return (
      <section aria-label="A/B 실험" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary, #fff)' }}>
          🧪 A/B 실험 ({windowDays}일)
        </h2>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
          진행 중 실험 없음. 등록된 실험: {experiments.map((e) => e.name).join(', ')}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="A/B 실험" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary, #fff)' }}>
        🧪 A/B 실험 ({windowDays}일)
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.map(({ spec, rows }) => (
          <div
            key={spec.name}
            style={{
              padding: 12,
              background: 'var(--bg-elevated, #1f2028)',
              border: '1px solid var(--border, #2a2b35)',
              borderRadius: 'var(--radius-md, 10px)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 8, wordBreak: 'keep-all' }}>
              {spec.label}
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-tertiary, #888)', fontFamily: 'monospace' }}>
                {spec.name}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              <thead style={{ background: 'var(--bg-hover, #2a2b35)' }}>
                <tr>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Variant</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>View</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Click</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>CTR</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>vs A</th>
                  <th style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>유의</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ctr = r.ctr_pct === null ? null : Number(r.ctr_pct);
                  const vs = r.vs_control_pct === null ? null : Number(r.vs_control_pct);
                  return (
                    <tr key={r.variant} style={{ borderTop: '1px solid var(--border, #2a2b35)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{r.variant}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{Number(r.views).toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{Number(r.clicks).toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: ctrTone(ctr) }}>
                        {ctr === null ? '—' : `${ctr.toFixed(2)}%`}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: deltaTone(vs, r.significant) }}>
                        {r.variant === 'A' ? '—' : vs === null ? '—' : `${vs >= 0 ? '+' : ''}${vs.toFixed(1)}%`}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: r.significant ? '#22c55e' : 'var(--text-tertiary, #888)', fontSize: 11 }}>
                        {r.significant ? '✓' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
        유의 = views ≥ 100 + |Δ| ≥ 0.5%pt 차이. 정확한 통계 검정 (chi-square) 은 별도.
      </div>
    </section>
  );
}
