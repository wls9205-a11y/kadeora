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
        background: 'linear-gradient(145deg, rgba(212,168,83,0.08) 0%, rgba(184,148,46,0.03) 50%, rgba(212,168,83,0.06) 100%)',
        border: '1.5px solid rgba(212,168,83,0.25)',
        transition: 'transform 0.1s, border-color var(--transition-fast)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 상단 골드 라인 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #B8942E, #D4A853, #E8C778, #D4A853, #B8942E)' }} />
        {/* 배경 데코 */}
        <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(212,168,83,0.04)' }} />

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #D4A853, #B8942E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3 }}>카더라 데일리</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#D4A853', letterSpacing: 2, background: 'rgba(212,168,83,0.1)', padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(212,168,83,0.2)' }}>VIP</span>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {now.getMonth() + 1}월 {now.getDate()}일 {dayNames[now.getDay()]}요일 {isWeekend ? '· 주말판' : '· 투자 브리핑'}
              </div>
            </div>
          </div>
          <div style={{
            padding: '8px 18px', borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, #D4A853, #B8942E)', color: '#fff',
            fontSize: 'var(--fs-sm)', fontWeight: 700, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(212,168,83,0.3)',
          }}>읽기 →</div>
        </div>

        {/* 핵심 지표 3칸 — 골드 테두리 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)', position: 'relative' }}>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.15)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: '#D4A853', marginBottom: 3, fontWeight: 600 }}>시총 1위</div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: data.topStockPct > 0 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
              {data.topStock.slice(0, 6)}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: data.topStockPct > 0 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
              {data.topStockPct > 0 ? '▲' : '▼'}{Math.abs(data.topStockPct).toFixed(1)}%
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.15)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: '#D4A853', marginBottom: 3, fontWeight: 600 }}>이번주 청약</div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: '#E8C778' }}>{data.subCount}건</div>
            {data.topSub && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.topSub.slice(0, 10)}</div>}
          </div>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.15)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: '#D4A853', marginBottom: 3, fontWeight: 600 }}>전국 미분양</div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: '#E8C778' }}>{(data.unsoldUnits / 10000).toFixed(1)}만</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{data.unsoldUnits.toLocaleString()}세대</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
