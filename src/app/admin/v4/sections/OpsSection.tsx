'use client';
import React, { useState } from 'react';
import AdminKPI from '../components/AdminKPI';
import AlertCard from '../components/AlertCard';

interface FailedCron {
  name: string; fail_count: number; last_at?: string; last_error?: string | null;
}

interface Props {
  data: {
    cron_24h?: { ok?: number; fail?: number; total?: number; pct?: number };
    pv_today?: number;
    uv_today?: number;
    failed_24h?: FailedCron[];
  };
}

export default function OpsSection({ data }: Props) {
  const [godOpen, setGodOpen] = useState(false);
  const c = data.cron_24h ?? {};
  const failed = data.failed_24h ?? [];
  const cronHealth = (c.pct ?? 0) >= 95 ? 'ok' : (c.pct ?? 0) >= 80 ? 'warn' : 'critical';

  return (
    <section style={{
      padding: 16, borderRadius: 'var(--radius-lg, 14px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', margin: 0 }}>⚙️ 운영</h2>
        <button
          onClick={() => setGodOpen(v => !v)}
          style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #2a2b35)',
            background: 'transparent', color: 'var(--text-secondary, #ccc)', cursor: 'pointer',
          }}
        >
          🛠️ 일괄 최신화
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="24시간 크론" value={`${c.pct ?? 0}%`} delta={`성공 ${c.ok ?? 0} / 실패 ${c.fail ?? 0}`} deltaColor={(c.fail ?? 0) > 0 ? 'red' : 'tertiary'} health={cronHealth} />
        <AdminKPI label="크론 등록" value="100" unit="/100" />
        <AdminKPI label="오늘 PV" value={(data.pv_today ?? 0).toLocaleString()} />
        <AdminKPI label="오늘 UV" value={(data.uv_today ?? 0).toLocaleString()} />
      </div>

      <div style={{ marginTop: 12 }}>
        <AlertCard severity="warn" title="실패 크론 (24시간)" hideWhenEmpty count={failed.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {failed.slice(0, 12).map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.18)' }}>
                <code style={{ fontSize: 11, color: 'var(--text-secondary, #ccc)' }}>{f.name}</code>
                <span style={{ fontSize: 11, color: 'var(--accent-orange, #fb923c)', fontWeight: 700 }}>×{f.fail_count}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.last_error?.trim() || '—'}
                </span>
              </div>
            ))}
          </div>
        </AlertCard>
      </div>

      {godOpen && (
        <div
          onClick={() => setGodOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: 'min(420px, 92vw)', height: '100%', padding: 20,
            background: 'var(--bg-surface, #1a1b22)', borderLeft: '1px solid var(--border, #2a2b35)',
            display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, color: 'var(--text-primary, #fff)' }}>🛠️ 일괄 최신화</strong>
              <button onClick={() => setGodOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary, #888)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary, #ccc)', margin: 0 }}>
              긴급 운영 액션 — 다음 단계에서 채워질 예정. 현재는 파이프라인 즉시 실행만 노출.
            </p>
            <a href="/api/admin/issues/run-pipeline" style={{ fontSize: 12, color: 'var(--accent, #3b82f6)', textDecoration: 'none' }}>
              POST /api/admin/issues/run-pipeline →
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
