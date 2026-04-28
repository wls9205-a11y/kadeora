'use client';
import React, { useState } from 'react';
import AdminKPI from '../components/AdminKPI';
import PipelineStages from '../components/PipelineStages';

interface Props {
  data: {
    last_orchestrator_at?: string;
    stages_24h?: Record<string, { ok?: number; fail?: number }>;
    publish_7d?: { total?: number; img5_count?: number; img5_pct?: number; hub_link_count?: number; hub_link_pct?: number };
  };
}

function relTime(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function IssuePipelineSection({ data }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const p7 = data.publish_7d ?? {};

  const runOrchestrator = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch('/api/admin/issues/run-pipeline', { method: 'POST' });
      const j = await r.json().catch(() => null);
      setResult(j ? `ok=${r.status} duration=${j.total_duration_ms ?? '?'}ms steps=${j.steps?.length ?? 0}` : `status=${r.status}`);
    } catch (e: any) {
      setResult(`err: ${e?.message ?? 'failed'}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section style={{
      padding: 16, borderRadius: 'var(--radius-lg, 14px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', margin: 0 }}>
          🔄 Issue Pipeline
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
          마지막 orchestrator: <strong style={{ color: 'var(--text-secondary, #ccc)' }}>{relTime(data.last_orchestrator_at)}</strong>
        </span>
        <button
          onClick={runOrchestrator}
          disabled={running}
          style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            padding: '6px 12px', borderRadius: 6, cursor: running ? 'wait' : 'pointer',
            background: 'var(--accent, #3b82f6)', color: '#fff', border: 'none',
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? '실행 중…' : '⚡ orchestrator 즉시'}
        </button>
      </div>

      {result && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #ccc)', padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, marginBottom: 10 }}>
          {result}
        </div>
      )}

      <PipelineStages stages={data.stages_24h ?? {}} />

      <div style={{
        marginTop: 12, padding: 12, borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-surface, #1a1b22)', border: '1px solid var(--border, #2a2b35)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8,
      }}>
        <AdminKPI label="7d publish total" value={p7.total ?? 0} />
        <AdminKPI label="image≥5" value={`${p7.img5_pct ?? 0}%`} health={(p7.img5_pct ?? 0) >= 90 ? 'ok' : (p7.img5_pct ?? 0) >= 70 ? 'warn' : 'critical'} />
        <AdminKPI label="hub link 본문" value={`${p7.hub_link_pct ?? 0}%`} health={(p7.hub_link_pct ?? 0) >= 70 ? 'ok' : (p7.hub_link_pct ?? 0) >= 30 ? 'warn' : 'critical'} />
      </div>
    </section>
  );
}
