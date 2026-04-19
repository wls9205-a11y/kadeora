'use client';

/**
 * DashboardV2 — 14일 트렌드 + CTA TOP 15 + page × cta CTR 매트릭스
 */

import { useEffect, useState } from 'react';

interface TrendRow {
  dt: string;
  signups?: number;
  pv?: number;
  unique_visitors?: number;
  daily_ctr_pct?: number;
  signup_per_visitor_pct?: number;
}

interface CtaRow {
  cta_name: string;
  device_type?: string;
  views?: number;
  unique_viewers?: number;
  clicks?: number;
  ctr_pct?: number;
  signup_success_pct?: number;
  health?: string;
}

interface MatrixRow {
  page_group?: string;
  cta_name?: string;
  ctr_pct?: number;
  views?: number;
}

export default function DashboardV2() {
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [cta, setCta] = useState<CtaRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/dashboard-v2')
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        setTrends(j.trends || []);
        setCta(j.cta || []);
        setMatrix(j.matrix || []);
        if (j.error) setErr(j.error);
      })
      .catch((e) => !cancelled && setErr(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 16, color: 'var(--text-primary, #e5e7eb)' }}>
      <h3 style={sec()}>📈 14일 트렌드</h3>
      {loading ? <Skel /> : <TrendSpark rows={trends} />}

      <h3 style={sec()}>🎯 CTA TOP 15</h3>
      {loading ? <Skel /> : <CtaTable rows={cta} />}

      <h3 style={sec()}>🔲 Page × CTA CTR 매트릭스</h3>
      {loading ? <Skel /> : <MatrixTable rows={matrix} />}

      {err && <div style={{ color: '#F87171', fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function TrendSpark({ rows }: { rows: TrendRow[] }) {
  if (!rows.length) return <Empty />;
  const max = (key: keyof TrendRow) => Math.max(1, ...rows.map((r) => Number(r[key] ?? 0)));
  const maxSignup = max('signups');
  const maxPv = max('pv');
  const maxCtr = max('daily_ctr_pct');
  const maxSpv = max('signup_per_visitor_pct');
  const w = Math.max(60, 100 / rows.length);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
      <SparkPanel title="Signups & PV" rows={rows.map((r) => ({ dt: r.dt, a: Number(r.signups || 0) / maxSignup, b: Number(r.pv || 0) / maxPv, aVal: r.signups, bVal: r.pv }))} barW={w} legendA="signups" legendB="pv" />
      <SparkPanel title="Daily CTR % / Signup per Visitor %" rows={rows.map((r) => ({ dt: r.dt, a: Number(r.daily_ctr_pct || 0) / maxCtr, b: Number(r.signup_per_visitor_pct || 0) / maxSpv, aVal: r.daily_ctr_pct, bVal: r.signup_per_visitor_pct }))} barW={w} legendA="ctr%" legendB="signup/v%" />
    </div>
  );
}

function SparkPanel({ title, rows, barW, legendA, legendB }: { title: string; rows: Array<{ dt: string; a: number; b: number; aVal?: any; bVal?: any }>; barW: number; legendA: string; legendB: string }) {
  return (
    <div style={card()}>
      <div style={cardTitle()}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {rows.map((r, i) => (
          <div key={i} title={`${r.dt} · ${legendA}=${r.aVal ?? '?'} · ${legendB}=${r.bVal ?? '?'}`} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: 1, minWidth: barW }}>
            <div style={{ height: `${Math.max(2, r.a * 100)}%`, background: '#8b5cf6', borderRadius: 2 }} />
            <div style={{ height: `${Math.max(2, r.b * 100)}%`, background: '#06b6d4', borderRadius: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span><b style={{ color: '#8b5cf6' }}>■</b> {legendA}</span>
        <span><b style={{ color: '#06b6d4' }}>■</b> {legendB}</span>
      </div>
    </div>
  );
}

function CtaTable({ rows }: { rows: CtaRow[] }) {
  if (!rows.length) return <Empty />;
  const healthColor = (h?: string) => {
    if (h === 'excellent') return '#10B981';
    if (h === 'good') return '#22D3EE';
    if (h === 'low') return '#F59E0B';
    if (h === 'dead') return '#EF4444';
    return 'rgba(255,255,255,0.4)';
  };
  return (
    <div style={card()}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['CTA','device','views','unique','clicks','CTR%','signup%','health'].map((h) => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.cta_name}-${r.device_type}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={td()}>{r.cta_name}</td>
              <td style={td()}>{r.device_type || '—'}</td>
              <td style={td()}>{(r.views || 0).toLocaleString()}</td>
              <td style={td()}>{(r.unique_viewers || 0).toLocaleString()}</td>
              <td style={td()}>{(r.clicks || 0).toLocaleString()}</td>
              <td style={td()}>{Number(r.ctr_pct || 0).toFixed(2)}%</td>
              <td style={td()}>{Number(r.signup_success_pct || 0).toFixed(2)}%</td>
              <td style={{ ...td(), color: healthColor(r.health), fontWeight: 700 }}>{r.health || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixTable({ rows }: { rows: MatrixRow[] }) {
  if (!rows.length) return <Empty />;
  const pageGroups = Array.from(new Set(rows.map((r) => r.page_group || '—')));
  const ctas = Array.from(new Set(rows.map((r) => r.cta_name || '—')));
  const m = new Map<string, MatrixRow>();
  for (const r of rows) m.set(`${r.page_group}|${r.cta_name}`, r);
  const cell = (p: string, c: string) => m.get(`${p}|${c}`);
  const color = (ctr?: number) => {
    if (!ctr || ctr === 0) return 'rgba(255,255,255,0.03)';
    if (ctr < 0.5) return 'rgba(239,68,68,0.25)';
    if (ctr < 2) return 'rgba(245,158,11,0.3)';
    if (ctr < 5) return 'rgba(34,211,238,0.35)';
    return 'rgba(16,185,129,0.4)';
  };
  return (
    <div style={{ ...card(), overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', textAlign: 'left' }}></th>
            {ctas.map((c) => <th key={c} style={{ padding: '6px 6px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 10 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {pageGroups.map((p) => (
            <tr key={p}>
              <td style={{ padding: '6px 8px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{p}</td>
              {ctas.map((c) => {
                const rc = cell(p, c);
                return (
                  <td key={c} style={{ padding: '4px 6px', textAlign: 'center', background: color(rc?.ctr_pct), minWidth: 48 }} title={`${p} × ${c} — ${rc?.ctr_pct?.toFixed(2) ?? '0'}% (${rc?.views ?? 0}v)`}>
                    {rc ? Number(rc.ctr_pct || 0).toFixed(1) : '·'}
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

const Skel = () => <div style={{ height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: 6, margin: '8px 0' }} />;
const Empty = () => <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>데이터 없음</div>;
const sec = (): React.CSSProperties => ({ fontSize: 14, fontWeight: 800, margin: '20px 0 8px', color: 'rgba(255,255,255,0.9)' });
const card = (): React.CSSProperties => ({ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.02)' });
const cardTitle = (): React.CSSProperties => ({ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 });
const td = (): React.CSSProperties => ({ padding: '6px 8px', whiteSpace: 'nowrap' });
