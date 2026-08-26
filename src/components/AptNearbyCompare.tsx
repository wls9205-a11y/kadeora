'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { priceChangeCompact, priceChangeDirection } from '@/lib/apt/price-change';

// 「변동률」 열은 2026-08-26 에 한 번 «뺐다가» 되살렸다.
//   뺀 이유: `price_change_1y` 는 대표 평형 하나를 고정해 잰 값인데, 평형을 안 붙이면
//   「단지 전체가 그만큼 움직였다」로 읽힌다 (실측 부호 반전 23.9%). 그때 이 표가 쓰는 RPC
//   `get_nearby_apt_compare` 가 근거 컬럼을 돌려주지 않아 붙일 수가 없었다.
//   되살린 이유: RPC 가 `price_change_area` · `n_recent` · `n_past` 를 «기존 컬럼 뒤에» 추가했다.
//
// ⚠️ 표시는 반드시 `priceChangeCompact()` 를 거친다 — 평형이 빠진 % 를 직접 조립하지 말 것.
//    근거가 하나라도 없으면 그 칸은 '-' 다 (lib/apt/price-change.ts).
interface Apt {
  apt_name: string; latest_sale_price: number; avg_sale_price_pyeong: number;
  jeonse_ratio: number; sale_count_1y: number; built_year: number;
  price_change_1y: number | null; price_change_area: number | null;
  price_change_n_recent: number | null; price_change_n_past: number | null;
}

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
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🏘️ {sigungu} 주변 단지 비교</div>
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
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: priceChangeDirection(a) === 'up' ? 'var(--accent-red)' : priceChangeDirection(a) === 'down' ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
                  {priceChangeCompact(a) || '-'}
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
