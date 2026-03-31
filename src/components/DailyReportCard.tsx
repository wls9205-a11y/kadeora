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
    <Link href={`/daily/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 'var(--sp-sm)' }}>
      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius-card)',
        background: 'linear-gradient(145deg, rgba(212,168,83,0.07) 0%, rgba(184,148,46,0.02) 100%)',
        border: '1px solid rgba(212,168,83,0.2)',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 골드 로고 */}
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #D4A853, #B8942E)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="7" cy="12" r="4" fill="#E8C778" opacity="0.7"/><circle cx="12" cy="8" r="4" fill="#F5DDA0" opacity="0.8"/><circle cx="17" cy="12" r="4" fill="#E8C778" opacity="0.7"/></svg>
        </div>

        {/* 텍스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>카더라 데일리 리포트</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#D4A853', background: 'rgba(212,168,83,0.1)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(212,168,83,0.2)' }}>회원전용</span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
            {now.getMonth() + 1}/{now.getDate()} {dayNames[now.getDay()]} {isWeekend ? '주말판' : '투자 브리핑'}
          </div>
        </div>

        {/* CTA */}
        <div style={{
          padding: '6px 14px', borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, #D4A853, #B8942E)', color: '#fff',
          fontSize: 'var(--fs-xs)', fontWeight: 700, flexShrink: 0,
        }}>읽기 →</div>
      </div>
    </Link>
  );
}
