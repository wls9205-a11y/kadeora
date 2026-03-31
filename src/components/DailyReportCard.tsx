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
        padding: 'var(--card-p) 16px', borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(59,123,246,0.08) 0%, rgba(96,165,250,0.04) 100%)',
        border: '1.5px solid rgba(59,123,246,0.2)',
        transition: 'transform 0.1s, border-color 0.15s',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 배경 데코 원 */}
        <div style={{ position: 'absolute', right: -20, top: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(59,123,246,0.04)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -15, width: 50, height: 50, borderRadius: '50%', background: 'rgba(96,165,250,0.03)' }} />

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📊</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3 }}>카더라 데일리 리포트</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {now.getMonth() + 1}월 {now.getDate()}일 {dayNames[now.getDay()]}요일 {isWeekend ? '· 주말판' : ''}
              </div>
            </div>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 20, background: 'var(--brand)', color: '#fff',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>읽기 →</div>
        </div>

        {/* 핵심 지표 3칸 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, position: 'relative' }}>
          {/* 주식 */}
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}>시총 1위</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: data.topStockPct > 0 ? 'var(--accent-red)' : 'var(--brand)' }}>
              {data.topStock.slice(0, 6)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: data.topStockPct > 0 ? 'var(--accent-red)' : 'var(--brand)' }}>
              {data.topStockPct > 0 ? '▲' : '▼'}{Math.abs(data.topStockPct).toFixed(1)}%
            </div>
          </div>
          {/* 청약 */}
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}>이번주 청약</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{data.subCount}건</div>
            {data.topSub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.topSub.slice(0, 8)}</div>}
          </div>
          {/* 미분양 */}
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}>전국 미분양</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)' }}>{(data.unsoldUnits / 10000).toFixed(1)}만</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{data.unsoldUnits.toLocaleString()}세대</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
