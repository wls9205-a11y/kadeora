'use client';

/**
 * PulseV3Client — /admin/pulse_v3 page client.
 *
 * 4 widgets:
 *   1) 실시간 KPI 8-grid (master)
 *   2) 행동 전환 매트릭스 4×4 히트맵 (behaviorMatrix)
 *   3) 미가입 고래 TOP 10 (whales)
 *   4) Action Items 리스트 (actionItems)
 */

import { useEffect, useState } from 'react';

interface Master {
  active_now?: number;
  pv_today?: number;
  pv_yesterday?: number;
  uv_today?: number;
  signups_today?: number;
  signups_7d?: number;
  cta_ctr_7d?: number;
  whales_unconverted?: number;
  action_items_count?: number;
  [k: string]: unknown;
}

interface ActionItem {
  severity?: string;
  key?: string;
  message?: string;
  action?: string;
}

interface Whale {
  visitor_id?: string;
  pv?: number;
  active_days?: number;
  uniq_pages?: number;
  deep_reads?: number;
  last_seen?: string;
}

interface MatrixCell {
  blog_bucket?: string;
  apt_bucket?: string;
  visitors?: number;
  signups?: number;
  pct?: number;
}

export default function PulseV3Client() {
  const [data, setData] = useState<{
    master: Master | null;
    actionItems: ActionItem[];
    whales: Whale[];
    behaviorMatrix: MatrixCell[];
  }>({ master: null, actionItems: [], whales: [], behaviorMatrix: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/pulse_v3')
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        setData({
          master: j.master || null,
          actionItems: j.actionItems || [],
          whales: j.whales || [],
          behaviorMatrix: j.behaviorMatrix || [],
        });
        if (j.errors && Object.values(j.errors).some(Boolean)) {
          setErr(JSON.stringify(j.errors));
        }
      })
      .catch((e) => !cancelled && setErr(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const m = data.master;
  const pvYoYPct = m?.pv_today && m?.pv_yesterday && m.pv_yesterday > 0
    ? ((m.pv_today - m.pv_yesterday) / m.pv_yesterday) * 100
    : null;
  const actionCountBannerSeverity = (data.actionItems || []).some((a) => String(a.severity).toLowerCase().startsWith('red')) ? 'red'
    : (data.actionItems || []).some((a) => String(a.severity).toLowerCase().startsWith('yellow')) ? 'yellow' : null;

  return (
    <div style={{ padding: 16, color: 'var(--text-primary, #e5e7eb)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px' }}>🫀 Pulse v3</h1>

      {loading ? <Skel /> : err && !m ? (
        <div style={{ color: '#F87171' }}>{err}</div>
      ) : (
        <>
          {/* Banner — Action Items 개수 */}
          {actionCountBannerSeverity && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 14,
                background: actionCountBannerSeverity === 'red' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)',
                border: `1px solid ${actionCountBannerSeverity === 'red' ? '#EF4444' : '#F59E0B'}`,
                fontSize: 13, fontWeight: 700,
              }}
            >
              ⚠ Action Items {m?.action_items_count ?? data.actionItems.length}건 대기 중
            </div>
          )}

          {/* W1 — KPI 8-grid */}
          <section style={card()}>
            <div style={sec()}>⚡ 실시간 KPI</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <Kpi label="active_now" value={m?.active_now} />
              <Kpi label={pvYoYPct == null ? 'pv_today' : `pv_today (${pvYoYPct >= 0 ? '+' : ''}${pvYoYPct.toFixed(1)}%)`} value={m?.pv_today} />
              <Kpi label="uv_today" value={m?.uv_today} />
              <Kpi label="signups_today" value={m?.signups_today} />
              <Kpi label="signups_7d" value={m?.signups_7d} />
              <Kpi label="cta_ctr_7d (%)" value={m?.cta_ctr_7d != null ? Number(m.cta_ctr_7d).toFixed(2) : null} />
              <Kpi label="whales_unconverted" value={m?.whales_unconverted} />
              <Kpi label="action_items" value={m?.action_items_count ?? data.actionItems.length} />
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, marginTop: 14 }}>
            {/* W2 — Behavior 4x4 heatmap */}
            <section style={card()}>
              <div style={sec()}>🔥 Blog × APT 전환 매트릭스</div>
              <BehaviorMatrix rows={data.behaviorMatrix} />
            </section>

            {/* W3 — Whale TOP 10 */}
            <section style={card()}>
              <div style={sec()}>🐋 미가입 고래 TOP 10</div>
              <WhaleTable rows={data.whales} />
            </section>
          </div>

          {/* W4 — Action Items list */}
          <section style={{ ...card(), marginTop: 14 }}>
            <div style={sec()}>📋 Action Items</div>
            <ActionList rows={data.actionItems} />
          </section>

          {err && <div style={{ color: '#F59E0B', fontSize: 11, marginTop: 10 }}>Partial error: {err}</div>}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
        {value == null ? '—' : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
    </div>
  );
}

function BehaviorMatrix({ rows }: { rows: MatrixCell[] }) {
  if (!rows || rows.length === 0) return <Empty />;
  const blogBuckets = Array.from(new Set(rows.map((r) => r.blog_bucket || '?')));
  const aptBuckets = Array.from(new Set(rows.map((r) => r.apt_bucket || '?')));
  const cell = (b: string, a: string) => rows.find((r) => r.blog_bucket === b && r.apt_bucket === a);
  const color = (pct?: number) => {
    if (pct == null) return 'rgba(255,255,255,0.03)';
    if (pct === 0) return 'rgba(156,163,175,0.12)';
    if (pct < 1) return 'rgba(239,68,68,0.18)';
    if (pct < 3) return 'rgba(245,158,11,0.25)';
    if (pct < 10) return 'rgba(34,197,94,0.3)';
    if (pct < 20) return 'rgba(16,185,129,0.55)';
    return 'rgba(5,150,105,0.8)';
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={th()}>blog \ apt</th>
            {aptBuckets.map((a) => <th key={a} style={th()}>{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {blogBuckets.map((b) => (
            <tr key={b}>
              <td style={tdLead()}>{b}</td>
              {aptBuckets.map((a) => {
                const c = cell(b, a);
                return (
                  <td key={a} style={{
                    padding: '6px 6px', textAlign: 'center', minWidth: 60,
                    background: color(c?.pct),
                    color: c && c.pct && c.pct >= 20 ? '#fff' : 'inherit',
                  }} title={`visitors=${c?.visitors ?? 0} / signups=${c?.signups ?? 0}`}>
                    {c ? `${c.signups ?? 0}/${c.visitors ?? 0}` : '—'}
                    {c?.pct != null && <div style={{ fontSize: 9, opacity: 0.8 }}>{Number(c.pct).toFixed(1)}%</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WhaleTable({ rows }: { rows: Whale[] }) {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>{['visitor','pv','days','pages','deep','last_seen'].map((h) => <th key={h} style={th()}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((w, i) => (
            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={td()}>{w.visitor_id ? String(w.visitor_id).slice(0, 12) + '…' : '—'}</td>
              <td style={td()}>{w.pv ?? 0}</td>
              <td style={td()}>{w.active_days ?? 0}</td>
              <td style={td()}>{w.uniq_pages ?? 0}</td>
              <td style={td()}>{w.deep_reads ?? 0}</td>
              <td style={td()}>{w.last_seen ? new Date(w.last_seen).toLocaleDateString('ko-KR') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionList({ rows }: { rows: ActionItem[] }) {
  if (!rows || rows.length === 0) return <Empty />;
  const sevColor = (s?: string) => {
    const v = String(s || '').toLowerCase();
    if (v.startsWith('red')) return '#EF4444';
    if (v.startsWith('yellow')) return '#F59E0B';
    return '#22D3EE';
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((a, i) => (
        <div key={i} style={{
          padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${sevColor(a.severity)}55`,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: sevColor(a.severity), color: '#fff', fontWeight: 800 }}>
              {a.severity || 'info'}
            </span>
            <b>{a.key}</b>
          </div>
          {a.message && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>{a.message}</div>}
          {a.action && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>→ {a.action}</div>}
        </div>
      ))}
    </div>
  );
}

const Skel = () => <div style={{ height: 200, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }} />;
const Empty = () => <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>데이터 없음</div>;
const card = (): React.CSSProperties => ({ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, background: 'rgba(255,255,255,0.02)' });
const sec = (): React.CSSProperties => ({ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)', marginBottom: 10 });
const th = (): React.CSSProperties => ({ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.06)' });
const td = (): React.CSSProperties => ({ padding: '6px 8px', whiteSpace: 'nowrap' });
const tdLead = (): React.CSSProperties => ({ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 700, color: 'rgba(255,255,255,0.7)' });
