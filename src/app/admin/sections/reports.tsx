'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge, C, DataTable, Pill, Spinner, ago, fmt } from '../admin-shared';

export default function ReportsSection() {
  const [tab, setTab] = useState<'reports' | 'payments'>('reports');
  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text, margin: '0 0 16px' }}>🚨 신고 / 결제</h1>
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-lg)' }}>
        <Pill active={tab === 'reports'} onClick={() => setTab('reports')}>🚨 신고 관리</Pill>
        <Pill active={tab === 'payments'} onClick={() => setTab('payments')}>💳 결제 내역</Pill>
      </div>
      {tab === 'reports' && <ReportsTab />}
      {tab === 'payments' && <PaymentsTab />}
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=reports').then(r => r.json()).then(d => setReports(d.reports ?? [])).finally(() => setLoading(false));
  }, []);

  const action = async (id: number, act: string) => {
    await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: act === 'resolve' ? 'resolved' : 'dismissed' } : r));
  };

  if (loading) return <Spinner />;

  const pending = reports.filter(r => r.status === 'pending');

  return (
    <div>
      <div style={{ fontSize: 13, color: C.textSec, marginBottom: 'var(--sp-md)' }}>{pending.length}건 미처리</div>
      <DataTable
        headers={['사유', '상세', '유형', '신고자', '상태', '신고일', '조치']}
        rows={reports.map(r => [
          r.reason,
          <span key="d" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.details || '—'}</span>,
          <Badge key="t" color={C.cyan}>{r.content_type}</Badge>,
          r.profiles?.nickname || '—',
          r.status === 'pending' ? <Badge key="s" color={C.yellow}>미처리</Badge> : r.status === 'resolved' ? <Badge key="s" color={C.green}>처리</Badge> : <Badge key="s" color={C.textDim}>기각</Badge>,
          ago(r.created_at),
          r.status === 'pending' ? (
            <div key="a" style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
              <button onClick={() => action(r.id, 'resolve')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.greenBg, color: C.green, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>처리</button>
              <button onClick={() => action(r.id, 'dismiss')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>기각</button>
            </div>
          ) : '—',
        ])}
      />
    </div>
  );
}

function PaymentsTab() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=payments').then(r => r.json()).then(d => setPayments(d.payments ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const done = payments.filter(p => p.status === 'DONE');
  const totalAmount = done.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthAmount = done.filter(p => p.created_at?.startsWith(thisMonth)).reduce((s: number, p: any) => s + (p.amount || 0), 0);

  return (
    <div>
      <div className="mc-g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 'var(--sp-lg)' }}>
        {[
          { label: '총 결제', value: `${payments.length}건`, color: C.brand },
          { label: '총 금액', value: `${totalAmount.toLocaleString()}원`, color: C.green },
          { label: '이번 달', value: `${monthAmount.toLocaleString()}원`, color: C.purple },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: C.textDim }}>{s.label}</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <DataTable
        headers={['결제일', '유저', '상품', '금액', '주문번호', '상태']}
        rows={payments.map(p => [
          p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '—',
          p.user_id?.slice(0, 8) || '—',
          p.product_id || '—',
          <span key="a" style={{ fontWeight: 700 }}>{(p.amount || 0).toLocaleString()}원</span>,
          <span key="o" style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.order_id || '—'}</span>,
          <Badge key="s" color={p.status === 'DONE' ? C.green : p.status === 'CANCELED' ? C.textDim : C.red}>{p.status}</Badge>,
        ])}
      />
    </div>
  );
}

// ══════════════════════════════════════
// ⚡ GOD MODE
// ══════════════════════════════════════
