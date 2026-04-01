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
    <Link href={`/daily/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--radius-card)',
        background: 'linear-gradient(145deg, rgba(212,168,83,0.07) 0%, rgba(184,148,46,0.02) 100%)',
        border: '1px solid rgba(212,168,83,0.2)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <svg width="28" height="28" viewBox="0 0 72 72" style={{ flexShrink: 0 }}><defs><linearGradient id="rcl" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E"/><stop offset="100%" stopColor="#2563EB"/></linearGradient></defs><rect x="2" y="2" width="68" height="68" rx="16" fill="url(#rcl)" stroke="#D4A853" strokeWidth="4"/><circle cx="18" cy="36" r="6" fill="white"/><circle cx="36" cy="36" r="6" fill="white"/><circle cx="54" cy="36" r="6" fill="white"/></svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>카더라 데일리 리포트</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#D4A853', background: 'rgba(212,168,83,0.1)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(212,168,83,0.2)' }}>회원전용</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {now.getMonth() + 1}/{now.getDate()} {dayNames[now.getDay()]} {isWeekend ? '주말판' : '투자 브리핑'}
          </div>
        </div>
        <div style={{ padding: '5px 12px', borderRadius: 14, background: 'linear-gradient(135deg, #D4A853, #B8942E)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>읽기 →</div>
      </div>
    </Link>
  );
}
