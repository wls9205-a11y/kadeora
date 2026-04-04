'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Apt { apt_name: string; latest_sale_price: number; avg_sale_price_pyeong: number; price_change_1y: number; jeonse_ratio: number; sale_count_1y: number; built_year: number; }

export default function AptNearbyCompare({ aptName, sigungu }: { aptName: string; sigungu: string }) {
  const [data, setData] = useState<Apt[]>([]);
  useEffect(() => {
    fetch(`/api/public/apt-nearby?apt=${encodeURIComponent(aptName)}&sigungu=${encodeURIComponent(sigungu)}`)
      .then(r => r.json()).then(d => setData(d.data || [])).catch(() => {});
  }, [aptName, sigungu]);

  if (!data.length) return null;
  const fmtP = (v: number) => !v ? '-' : v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${v.toLocaleString()}만`;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>🏘️ {sigungu} 주변 단지 비교</div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11 }}>단지</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11 }}>최근 매매</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11 }}>평당가</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11 }}>변동률</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11 }}>거래</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>
                  <Link href={`/apt/complex/${encodeURIComponent(a.apt_name)}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{a.apt_name}</Link>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>{a.built_year}년</div>
                </td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{fmtP(a.latest_sale_price)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtP(a.avg_sale_price_pyeong)}/평</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: a.price_change_1y > 0 ? '#E24B4A' : a.price_change_1y < 0 ? '#3B7BF6' : 'var(--text-tertiary)' }}>
                  {a.price_change_1y != null ? `${a.price_change_1y > 0 ? '+' : ''}${a.price_change_1y}%` : '-'}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-tertiary)' }}>{a.sale_count_1y}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
