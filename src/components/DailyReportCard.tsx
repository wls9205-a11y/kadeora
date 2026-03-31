'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DailyReportCard() {
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRegion(localStorage.getItem('daily_region') || '서울');
    }
  }, []);

  if (!region) return null;

  const now = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  return (
    <Link href={`/daily/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
      <div style={{
        padding: '16px 18px', borderRadius: 'var(--radius-lg)',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #D4A853, #B8942E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3 }}>카더라 데일리 리포트</span>
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

        {/* 설명 */}
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, position: 'relative' }}>
          주식 시황 · 청약 캘린더 · 미분양 현황 · 재개발 동향 — 매일 아침 한 장으로 정리된 투자 브리핑
        </div>
      </div>
    </Link>
  );
}
