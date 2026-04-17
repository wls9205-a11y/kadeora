'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * 오늘의 인기 종목 20선 — 모든 페이지 푸터 위에 표시
 * 세션당 PV 증가 + 내부 링크 밀도 향상 + SEO
 * ClientDynamics.tsx에서 로드
 */

interface TrendStock {
  symbol: string;
  name: string;
  change_pct: number;
}

export default function TrendingStocksBelt() {
  const [stocks, setStocks] = useState<TrendStock[]>([]);

  useEffect(() => {
    fetch('/api/data/stock-prices?limit=20&sort=volume')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data?.length) {
          setStocks(d.data.slice(0, 20).map((s: any) => ({
            symbol: s.symbol,
            name: s.name,
            change_pct: Number(s.change_pct ?? 0),
          })));
        }
      })
      .catch(() => {});
  }, []);

  if (!stocks.length) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '12px 16px',
      marginTop: '16px',
    }}>
      <p style={{
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-tertiary)',
        marginBottom: '8px',
        textAlign: 'center',
      }}>
        🔥 오늘의 인기 종목
      </p>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '6px',
      }}>
        {stocks.map(s => (
          <Link
            key={s.symbol}
            href={`/stock/${s.symbol}`}
            style={{
              padding: '4px 10px',
              borderRadius: '14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              textDecoration: 'none',
              color: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {s.name}
            <span style={{
              marginLeft: '4px',
              color: s.change_pct >= 0 ? '#ef4444' : '#3b82f6',
              fontWeight: 600,
            }}>
              {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(1)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
