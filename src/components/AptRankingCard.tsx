'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const TYPES = [
  { key: 'price_up', label: '🔥 상승률 TOP', color: '#E24B4A' },
  { key: 'price_down', label: '📉 하락률 TOP', color: '#3B7BF6' },
  { key: 'trade_volume', label: '📊 거래량 TOP', color: '#34D399' },
  { key: 'jeonse_ratio', label: '🏠 전세가율 TOP', color: '#FBB724' },
  { key: 'expensive', label: '💎 최고가 TOP', color: '#B794FF' },
];

interface Apt { apt_name: string; sigungu: string; region_nm: string; latest_sale_price: number; avg_sale_price_pyeong: number; price_change_1y: number; sale_count_1y: number; jeonse_ratio: number; }

export default function AptRankingCard() {
  const [type, setType] = useState('price_up');
  const [data, setData] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/apt-rankings?type=${type}&limit=10`)
      .then(r => r.json()).then(d => { setData(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type]);

  const fmtPrice = (v: number) => v >= 10000 ? `${(v/10000).toFixed(1)}억` : `${v?.toLocaleString()}만`;
  const cur = TYPES.find(t => t.key === type);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>🏆 아파트 랭킹</span>
        <Link href="/apt/complex" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>전체보기 →</Link>
      </div>
      <div className="apt-pill-scroll kd-scroll-row" style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none', paddingBottom: 2 }}>
        {TYPES.map(t => (
          <button key={t.key} onClick={() => setType(t.key)} style={{
            padding: '5px 10px', borderRadius: 'var(--radius-lg)', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
            background: type === t.key ? t.color + '18' : 'var(--bg-hover)', color: type === t.key ? t.color : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>로딩 중...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.map((a, i) => (
            <Link href={`/apt/complex/${encodeURIComponent(a.apt_name)}`} key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
              background: i < 3 ? (cur?.color || '#3B7BF6') + '06' : 'transparent', textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i < 3 ? cur?.color : 'var(--text-tertiary)', textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.apt_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.region_nm} {a.sigungu}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {type === 'price_up' || type === 'price_down' ? (
                  <span style={{ fontSize: 13, fontWeight: 700, color: a.price_change_1y > 0 ? '#E24B4A' : '#3B7BF6' }}>
                    {a.price_change_1y > 0 ? '▲' : '▼'}{Math.abs(a.price_change_1y).toFixed(1)}%
                  </span>
                ) : type === 'trade_volume' ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{a.sale_count_1y}건</span>
                ) : type === 'jeonse_ratio' ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#FBB724' }}>{a.jeonse_ratio}%</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtPrice(a.latest_sale_price)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
