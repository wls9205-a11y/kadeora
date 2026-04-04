'use client';
import { useState, useEffect } from 'react';

interface Range { high_price: number; high_date: string; low_price: number; low_date: string; current_price: number; from_high_pct: number; from_low_pct: number; }

export default function Stock52WeekBar({ symbol, currency }: { symbol: string; currency?: string }) {
  const [d, setD] = useState<Range | null>(null);
  useEffect(() => {
    fetch(`/api/public/stock-52w?symbol=${symbol}`).then(r => r.json()).then(r => setD(r.data)).catch(() => {});
  }, [symbol]);
  if (!d || !d.high_price) return null;

  const range = d.high_price - d.low_price;
  const pos = range > 0 ? ((d.current_price - d.low_price) / range) * 100 : 50;
  const fmt = (v: number) => currency === 'USD' ? `$${v.toLocaleString()}` : `${v.toLocaleString()}원`;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6 }}>52주 범위</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#3B7BF6', fontWeight: 600 }}>{fmt(d.low_price)}</span>
        <span style={{ color: '#E24B4A', fontWeight: 600 }}>{fmt(d.high_price)}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pos}%`, background: 'linear-gradient(90deg, #3B7BF6, #34D399)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: `${pos}%`, top: -3, width: 12, height: 12, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-base)', transform: 'translateX(-6px)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        <span>최저가 대비 +{d.from_low_pct}%</span>
        <span>최고가 대비 {d.from_high_pct}%</span>
      </div>
    </div>
  );
}
