'use client';
import React from 'react';
import AdminKPI from '../components/AdminKPI';
import AlertCard from '../components/AlertCard';

interface FunnelData {
  attempts?: number; oauth_clicks?: number; oauth_returns?: number;
  profile_created?: number; completed?: number;
  drop_before_provider?: number; drop_at_callback?: number;
  drop_at_profile?: number; drop_at_onboarding?: number;
}

interface CtaItem { cta_name: string; views_24h?: number; clicks_24h?: number; ctr?: number | null; completes_24h?: number }
interface MatrixRow { source: string; provider: string; attempts: number; successes: number; success_pct: number; last_attempt_at?: string }

interface Props {
  data: {
    today?: { attempts?: number; success?: number };
    _7d?: { attempts?: number; success?: number };
    funnel_7d?: FunnelData;
    broken_ctas?: { count?: number; items?: CtaItem[] };
    weak_ctas?:   { count?: number; items?: CtaItem[] };
    source_provider_matrix?: MatrixRow[];
  };
  ctrAvg?: number;
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)',
  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
};

const subTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)',
  textTransform: 'uppercase', marginTop: 14, marginBottom: 6, letterSpacing: 0.4,
};

export default function SignupCTASection({ data, ctrAvg }: Props) {
  const today = data.today ?? {};
  const w = data._7d ?? {};
  const successRate7d = (w.attempts && w.success != null)
    ? Math.round((w.success / Math.max(1, w.attempts)) * 100) : null;

  const f = data.funnel_7d ?? {};
  const stages: { label: string; value: number | undefined; drop?: number; dropLabel?: string }[] = [
    { label: '시도',          value: f.attempts },
    { label: 'OAuth 클릭',    value: f.oauth_clicks,    drop: f.drop_before_provider, dropLabel: 'OAuth 진입 전 이탈' },
    { label: 'OAuth 복귀',    value: f.oauth_returns,   drop: f.drop_at_callback,     dropLabel: '콜백 이탈' },
    { label: '프로필 생성',   value: f.profile_created, drop: f.drop_at_profile,      dropLabel: '프로필 이탈' },
    { label: '가입 완료',     value: f.completed,       drop: f.drop_at_onboarding,   dropLabel: '온보딩 이탈' },
  ];

  const broken = data.broken_ctas ?? { count: 0, items: [] };
  const weak = data.weak_ctas ?? { count: 0, items: [] };

  return (
    <section style={{
      padding: 16, borderRadius: 'var(--radius-lg, 14px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <h2 style={sectionTitleStyle}>🎯 가입 & CTA</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="오늘 시도" value={today.attempts ?? 0} health={(today.attempts ?? 0) === 0 ? 'critical' : 'ok'} />
        <AdminKPI label="7일 시도" value={w.attempts ?? 0} />
        <AdminKPI label="7일 성공률" value={successRate7d == null ? '—' : `${successRate7d}%`} health={successRate7d != null && successRate7d < 30 ? 'warn' : 'ok'} />
        <AdminKPI label="24시간 평균 CTR" value={ctrAvg != null ? `${ctrAvg.toFixed(2)}%` : '—'} health={ctrAvg != null && ctrAvg < 1 ? 'warn' : 'ok'} />
      </div>

      <AlertCard severity="critical" title="작동 안함 CTA" hideWhenEmpty count={broken.count ?? 0}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(broken.items ?? []).slice(0, 6).map(c => (
            <div key={c.cta_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
              <code style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>{c.cta_name}</code>
              <span style={{ fontSize: 11, color: 'var(--text-secondary, #ccc)' }}>
                노출 <strong>{c.views_24h ?? 0}</strong> · 클릭 <strong>{c.clicks_24h ?? 0}</strong>
              </span>
            </div>
          ))}
        </div>
      </AlertCard>

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #ccc)', cursor: 'pointer' }}>
          저조 CTA ({weak.count ?? 0}) ▼
        </summary>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          {(weak.items ?? []).slice(0, 12).map(c => (
            <div key={c.cta_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.2)' }}>
              <code style={{ color: 'var(--text-secondary, #ccc)' }}>{c.cta_name}</code>
              <span style={{ color: 'var(--text-tertiary, #888)' }}>
                노출 {c.views_24h ?? 0} / 클릭 {c.clicks_24h ?? 0} {c.ctr != null ? `· ${c.ctr}%` : ''}
              </span>
            </div>
          ))}
        </div>
      </details>

      <div style={subTitleStyle}>7일 깔때기 (이탈 분석)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stages.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.18)' }}>
            <div style={{ width: 16, fontSize: 10, color: 'var(--text-tertiary, #888)' }}>{i + 1}</div>
            <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #ccc)', flex: 1 }}>{s.label}</code>
            <strong style={{ fontSize: 13, color: 'var(--text-primary, #fff)', minWidth: 40, textAlign: 'right' }}>{s.value ?? 0}</strong>
            {i > 0 && s.drop != null && s.drop > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-red, #f87171)' }}>
                -{s.drop} {s.dropLabel}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={subTitleStyle}>출처 × 제공사 매트릭스 (상위 12)</div>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: 'var(--text-tertiary, #888)', textAlign: 'left' }}>
              <th style={{ padding: 6 }}>출처</th>
              <th style={{ padding: 6 }}>제공사</th>
              <th style={{ padding: 6, textAlign: 'right' }}>시도</th>
              <th style={{ padding: 6, textAlign: 'right' }}>성공</th>
              <th style={{ padding: 6, textAlign: 'right' }}>성공률</th>
            </tr>
          </thead>
          <tbody>
            {(data.source_provider_matrix ?? []).slice(0, 12).map((r, i) => (
              <tr key={`${r.source}-${r.provider}-${i}`} style={{ borderTop: '1px solid var(--border, #2a2b35)' }}>
                <td style={{ padding: 6 }}><code style={{ color: 'var(--text-secondary, #ccc)' }}>{r.source}</code></td>
                <td style={{ padding: 6, color: 'var(--text-tertiary, #888)' }}>{r.provider}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{r.attempts}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{r.successes}</td>
                <td style={{ padding: 6, textAlign: 'right', color: r.success_pct >= 30 ? 'var(--accent-green, #34d399)' : 'var(--text-secondary, #ccc)' }}>{r.success_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
