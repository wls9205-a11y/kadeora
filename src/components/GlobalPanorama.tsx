'use client';
import { useState, useEffect, useRef } from 'react';

interface Stock { symbol: string; name: string; price: number; change_pct: number | null; market: string; currency?: string; }
interface Props { stocks: Stock[]; exchangeRate: number; briefingKR?: Record<string,any> | null; briefingUS?: Record<string,any> | null; }

export default function GlobalPanorama({ stocks, exchangeRate, briefingKR, briefingUS }: Props) {
  const [time, setTime] = useState('');
  const tickerRef = useRef<HTMLDivElement>(null);
  const [fgScore, setFgScore] = useState(62);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFgScore(s => Math.max(15, Math.min(85, s + (Math.random() - 0.5) * 3))), 4000);
    return () => clearInterval(id);
  }, []);

  // 티커 데이터 — 상위 이슈 종목
  const tickerStocks = stocks.filter(s => s.price > 0 && Math.abs(s.change_pct ?? 0) > 0.1).sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0)).slice(0, 16);

  const upC = (isUS: boolean) => isUS ? '#2EE8A5' : '#FF6B6B';
  const dnC = (isUS: boolean) => isUS ? '#FF6B6B' : '#6CB4FF';

  const fgColor = fgScore >= 75 ? '#FF6B6B' : fgScore >= 55 ? '#FFB41E' : fgScore >= 45 ? '#94A3B8' : '#6CB4FF';
  const fgLabel = fgScore >= 75 ? '극단 탐욕' : fgScore >= 55 ? '탐욕' : fgScore >= 45 ? '중립' : fgScore >= 25 ? '공포' : '극단 공포';

  // 섹터별 집계
  const usStocks = stocks.filter(s => (s.market === 'NYSE' || s.market === 'NASDAQ') && s.price > 0);
  type SecMap = Record<string, number[]>;
  const secMap: SecMap = {};
  usStocks.forEach(s => {
    const sec = (s as any).sector || '기타';
    if (!secMap[sec]) secMap[sec] = [];
    secMap[sec].push(s.change_pct ?? 0);
  });
  const usSectors = Object.entries(secMap).map(([name, pcts]) => ({ name, avg: pcts.reduce((a, b) => a + b, 0) / pcts.length })).sort((a, b) => b.avg - a.avg).slice(0, 6);

  const fmtPrice = (s: Stock) => s.currency === 'USD' ? `$${Number(s.price).toFixed(2)}` : `₩${Number(s.price).toLocaleString()}`;

  return (
    <div style={{ marginBottom: 'var(--sp-md)' }}>
      {/* 티커 테이프 */}
      <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 10, height: 28, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', position: 'absolute', whiteSpace: 'nowrap', animation: 'kd-ticker 30s linear infinite' }}>
          {[...tickerStocks, ...tickerStocks].map((s, i) => {
            const pct = s.change_pct ?? 0;
            const isUS = s.currency === 'USD';
            const col = pct > 0 ? upC(isUS) : dnC(isUS);
            return (
              <span key={`${s.symbol}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', fontSize: 10, fontFamily: 'monospace', borderRight: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>{s.symbol}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtPrice(s)}</span>
                <span style={{ fontWeight: 700, color: col }}>{pct > 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%</span>
              </span>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes kd-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>

      {/* 상단 우측: 시간 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'monospace' }}>글로벌 파노라마</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{ time } KST</span>
      </div>

      {/* 공포탐욕 + VIX */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-sm)', marginBottom: 10 }}>
        {/* 공포탐욕 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>공포탐욕 지수</span><span>CNN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: fgColor, letterSpacing: '-1px', transition: 'color .4s' }}>{Math.round(fgScore)}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: fgColor, transition: 'color .4s' }}>{fgLabel}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, fontFamily: 'monospace' }}>
                <span>공포</span><span>중립</span><span>탐욕</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-hover)', display: 'flex' }}>
                <div style={{ width: '25%', background: '#3B82F6', opacity: 0.7 }} />
                <div style={{ width: '25%', background: '#6CB4FF', opacity: 0.5 }} />
                <div style={{ width: '25%', background: '#FFB41E', opacity: 0.7 }} />
                <div style={{ width: '25%', background: '#FF6B6B', opacity: 0.7 }} />
              </div>
              <div style={{ position: 'relative', height: 8, marginTop: 2 }}>
                <div style={{ position: 'absolute', left: `${Math.round(fgScore)}%`, transform: 'translateX(-50%)', width: 2, height: 8, background: fgColor, borderRadius: 1, transition: 'left .5s, background .4s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 환율 + 심리 요약 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 6 }}>USD/KRW</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px', marginBottom: 'var(--sp-xs)' }}>
            {exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {briefingKR && <div>🇰🇷 {briefingKR.sentiment === 'bullish' ? '🐂 강세' : briefingKR.sentiment === 'bearish' ? '🐻 약세' : '보합'}</div>}
            {briefingUS && <div>🇺🇸 {briefingUS.sentiment === 'bullish' ? '🐂 강세' : briefingUS.sentiment === 'bearish' ? '🐻 약세' : '보합'}</div>}
          </div>
        </div>
      </div>

      {/* 미국 섹터 등락 */}
      {usSectors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 5 }}>미국 섹터</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {usSectors.map(sec => {
              const c = sec.avg > 0 ? '#2EE8A5' : '#FF6B6B';
              const barW = Math.min(Math.abs(sec.avg) / 3 * 100, 100);
              return (
                <div key={sec.name} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sec.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: 'monospace' }}>{sec.avg > 0 ? '+' : ''}{sec.avg.toFixed(1)}%</div>
                  <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-hover)', marginTop: 'var(--sp-xs)', overflow: 'hidden' }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: c, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
