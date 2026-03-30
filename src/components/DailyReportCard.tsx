'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface DailySnippet {
  subCount: number;
  unsoldUnits: number;
  topStock: string;
  topStockPct: number;
  topSub: string;
  region: string;
}

export default function DailyReportCard() {
  const [data, setData] = useState<DailySnippet | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const sb = createSupabaseBrowser();
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const [subR, unsoldR, stockR] = await Promise.all([
          sb.from('apt_subscriptions')
            .select('house_nm, tot_supply_hshld_co')
            .gte('rcept_bgnde', weekStart.toISOString().slice(0, 10))
            .lte('rcept_bgnde', weekEnd.toISOString().slice(0, 10))
            .limit(20),
          sb.from('unsold_apts')
            .select('tot_unsold_hshld_co')
            .eq('is_active', true)
            .limit(500),
          sb.from('stock_quotes')
            .select('name, change_pct')
            .in('market', ['KOSPI', 'KOSDAQ'])
            .gt('price', 0)
            .order('market_cap', { ascending: false })
            .limit(5),
        ]);

        const subs = subR.data || [];
        const unsold = (unsoldR.data || []).reduce((s: number, r: any) => s + (r.tot_unsold_hshld_co || 0), 0);
        const stocks = stockR.data || [];
        const topStock = stocks[0] || { name: '-', change_pct: 0 };

        // 저장된 지역 or 서울
        const savedRegion = typeof window !== 'undefined' ? localStorage.getItem('daily_region') || '서울' : '서울';

        setData({
          subCount: subs.length,
          unsoldUnits: unsold,
          topStock: topStock.name,
          topStockPct: Number(topStock.change_pct || 0),
          topSub: subs[0]?.house_nm || '',
          region: savedRegion,
        });
      } catch { /* silent */ }
    };
    load();
  }, []);

  if (!data) return null;

  const now = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  return (
    <Link href={`/daily/${encodeURIComponent(data.region)}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        transition: 'transform 0.1s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>📊</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>카더라 데일리</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
              {now.getMonth() + 1}/{now.getDate()} {dayNames[now.getDay()]}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>전체 보기 →</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {data.topStockPct !== 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
              background: data.topStockPct > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
              color: data.topStockPct > 0 ? 'var(--accent-red)' : 'var(--text-brand)',
            }}>
              {data.topStock} {data.topStockPct > 0 ? '+' : ''}{data.topStockPct.toFixed(1)}%
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.08)', color: 'var(--text-brand)' }}>
            청약 {data.subCount}건
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,146,60,0.08)', color: 'var(--accent-yellow)' }}>
            미분양 {data.unsoldUnits.toLocaleString()}세대
          </span>
          {data.topSub && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.08)', color: 'var(--accent-green)' }}>
              {data.topSub.slice(0, 12)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
