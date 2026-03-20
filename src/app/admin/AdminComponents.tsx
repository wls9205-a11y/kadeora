'use client';
import { useState, ReactNode } from 'react';

export function KpiCard({ label, value, sub, color, icon, format }: {
  label: string; value: number; sub?: string; color: string; icon: string; format?: 'currency';
}) {
  const display = format === 'currency' ? (value||0).toLocaleString()+'원' : (value||0).toLocaleString();
  return (
    <div style={{ background:'var(--bg-surface)', borderRadius:12, padding:'18px 20px', borderLeft:`4px solid ${color}`, border:'1px solid var(--border)', borderLeftWidth:4, borderLeftColor:color }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <span style={{ fontSize:12, color:'var(--text-tertiary)', fontWeight:600, letterSpacing:0.5 }}>{label}</span>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', lineHeight:1.1, margin:'4px 0' }}>{display}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}

export function ActionBtn({ label, onClick, variant='default', size='md' }: {
  label: string; onClick: () => Promise<void>; variant?: 'default'|'danger'|'success'; size?: 'sm'|'md';
}) {
  const [state, setState] = useState<'idle'|'loading'|'ok'|'err'>('idle');
  const colors = { default:'var(--brand)', danger:'#ef4444', success:'#10b981' };
  const handle = async () => {
    setState('loading');
    try { await onClick(); setState('ok'); } catch { setState('err'); }
    setTimeout(() => setState('idle'), 2500);
  };
  return (
    <button onClick={handle} disabled={state==='loading'} style={{
      padding: size==='sm'?'4px 10px':'7px 16px', borderRadius:6, border:'none',
      cursor: state==='loading'?'default':'pointer', fontSize: size==='sm'?11:13, fontWeight:700,
      background: state==='ok'?'#10b981': state==='err'?'#ef4444': colors[variant],
      color:'white', opacity: state==='loading'?0.7:1, minWidth: size==='sm'?60:80,
    }}>
      {state==='loading'?'처리중...': state==='ok'?'✓ 완료': state==='err'?'✗ 실패': label}
    </button>
  );
}

export function Badge({ label, type='default' }: { label: string; type?: 'success'|'danger'|'warning'|'info'|'default' }) {
  const c: Record<string, {bg:string;color:string}> = {
    success:{bg:'#10b98120',color:'#10b981'}, danger:{bg:'#ef444420',color:'#ef4444'},
    warning:{bg:'#f59e0b20',color:'#f59e0b'}, info:{bg:'#3b82f620',color:'#3b82f6'},
    default:{bg:'var(--bg-hover)',color:'var(--text-tertiary)'},
  };
  const s = c[type]||c.default;
  return <span style={{ background:s.bg, color:s.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{label}</span>;
}

export function AdminTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:10 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-hover)' }}>
            {headers.map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'var(--text-secondary)', fontSize:11, whiteSpace:'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
      <div>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)' }}>{title}</h1>
        {sub && <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text-tertiary)' }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
