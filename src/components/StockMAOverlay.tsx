'use client';
import { useState, useEffect, useRef } from 'react';

interface MAData { date: string; close_price: number; ma5: number; ma20: number; ma60: number; volume: number; }

export default function StockMAOverlay({ symbol, currency }: { symbol: string; currency?: string }) {
  const [data, setData] = useState<MAData[]>([]);
  const [show, setShow] = useState({ ma5: true, ma20: true, ma60: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/api/public/stock-ma?symbol=${symbol}`).then(r => r.json()).then(d => setData(d.data || [])).catch(() => {});
  }, [symbol]);

  useEffect(() => {
    if (!data.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = 180;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

    const allPrices = data.flatMap(d => [d.close_price, show.ma5 ? d.ma5 : 0, show.ma20 ? d.ma20 : 0, show.ma60 ? d.ma60 : 0]).filter(v => v > 0);
    const min = Math.min(...allPrices) * 0.98, max = Math.max(...allPrices) * 1.02;
    const range = max - min || 1;
    const padL = 55, padR = 8, padT = 8, padB = 22;
    const cw = w - padL - padR, ch = h - padT - padB;
    const toX = (i: number) => padL + (i / (data.length - 1)) * cw;
    const toY = (v: number) => padT + ch - ((v - min) / range) * ch;

    ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'right';
    for (let i = 0; i <= 3; i++) {
      const v = min + (range * i / 3); const y = padT + ch - (ch * i / 3);
      const fmt = currency === 'USD' ? `$${v.toFixed(0)}` : `${v.toLocaleString()}`;
      ctx.fillText(fmt, padL - 4, y + 3);
      ctx.strokeStyle = '#88888815'; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }

    const drawLine = (key: keyof MAData, color: string, width: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      let started = false;
      data.forEach((d, i) => { const v = d[key] as number; if (!v || v <= 0) return; if (!started) { ctx.moveTo(toX(i), toY(v)); started = true; } else { ctx.lineTo(toX(i), toY(v)); } });
      ctx.stroke();
    };

    drawLine('close_price', '#3B7BF6', 1.8);
    if (show.ma5) drawLine('ma5', '#F59E0B', 1);
    if (show.ma20) drawLine('ma20', '#10B981', 1);
    if (show.ma60) drawLine('ma60', '#EF4444', 1);

    ctx.fillStyle = '#888'; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    [0, Math.floor(data.length / 2), data.length - 1].forEach(i => {
      if (data[i]) ctx.fillText(data[i].date.slice(5), toX(i), h - 4);
    });
  }, [data, show, currency]);

  if (!data.length) return null;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📊 이동평균선</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'ma5' as const, l: 'MA5', c: '#F59E0B' }, { k: 'ma20' as const, l: 'MA20', c: '#10B981' }, { k: 'ma60' as const, l: 'MA60', c: '#EF4444' }].map(m => (
            <button key={m.k} onClick={() => setShow(p => ({ ...p, [m.k]: !p[m.k] }))} style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: show[m.k] ? m.c + '20' : 'var(--bg-hover)', color: show[m.k] ? m.c : 'var(--text-tertiary)',
            }}>{m.l}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 180 }} />
    </div>
  );
}
