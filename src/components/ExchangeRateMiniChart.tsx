'use client';
import { useState, useEffect, useRef } from 'react';

export default function ExchangeRateMiniChart() {
  const [data, setData] = useState<{rate: number; recorded_date: string}[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch('/api/public/exchange-trend?limit=30').then(r => r.json()).then(d => setData((d.data || []).reverse())).catch(() => {});
  }, []);

  useEffect(() => {
    if (!data.length || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const w = canvasRef.current.width = canvasRef.current.offsetWidth * 2;
    const h = canvasRef.current.height = 60;
    ctx.clearRect(0, 0, w, h);
    const rates = data.map(d => d.rate);
    const min = Math.min(...rates), max = Math.max(...rates);
    const range = max - min || 1;
    ctx.beginPath();
    ctx.strokeStyle = '#3B7BF6';
    ctx.lineWidth = 1.5;
    rates.forEach((r, i) => {
      const x = (i / (rates.length - 1)) * w;
      const y = h - 4 - ((r - min) / range) * (h - 8);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data]);

  if (!data.length) return null;
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = latest && prev ? latest.rate - prev.rate : 0;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>USD/KRW</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{latest?.rate?.toLocaleString()}원</div>
        {change !== 0 && <div style={{ fontSize: 10, color: change > 0 ? '#E24B4A' : '#3B7BF6', fontWeight: 600 }}>{change > 0 ? '▲' : '▼'}{Math.abs(change).toFixed(1)}</div>}
      </div>
      <canvas ref={canvasRef} style={{ flex: 1, height: 30 }} />
    </div>
  );
}
