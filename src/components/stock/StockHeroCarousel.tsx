'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface HeroSlide {
  id: number;
  title_ko: string;
  subtitle_ko: string;
  slide_type: string;
  link_url: string;
  data: any;
}

interface Props {
  slides: HeroSlide[];
}

/**
 * 주식 메인 히어로 이미지 캐러셀
 * 
 * - 자동 회전 (5초)
 * - 좌우 화살표 + 인디케이터
 * - 모바일: 16:9, 데스크탑: 16:6
 * - 슬라이드별 배경 그라데이션 + 데이터 오버레이
 */

const SLIDE_COLORS: Record<string, { from: string; to: string }> = {
  gainers: { from: '#dc2626', to: '#f97316' },
  losers: { from: '#2563eb', to: '#6366f1' },
  volume: { from: '#059669', to: '#10b981' },
  theme: { from: '#7c3aed', to: '#a855f7' },
  earnings: { from: '#0891b2', to: '#06b6d4' },
  ipo: { from: '#d97706', to: '#f59e0b' },
  signals: { from: '#be123c', to: '#e11d48' },
  default: { from: '#1e293b', to: '#334155' },
};

export default function StockHeroCarousel({ slides }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent(prev => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent(prev => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // 자동 회전
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, next, slides.length]);

  if (!slides.length) return null;

  const slide = slides[current];
  const colors = SLIDE_COLORS[slide.slide_type] || SLIDE_COLORS.default;
  const items: Array<{ symbol: string; name: string; change_pct: number }> = slide.data?.items || [];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/7',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        transition: 'background 0.5s ease',
        marginBottom: '16px',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 콘텐츠 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 32px',
        color: '#fff',
        zIndex: 2,
      }}>
        <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {slide.slide_type === 'gainers' ? '🔥 오늘의 급등주' :
           slide.slide_type === 'losers' ? '📉 오늘의 급락주' :
           slide.slide_type === 'volume' ? '📊 거래량 TOP' :
           slide.slide_type === 'theme' ? '🎯 테마 시황' :
           slide.slide_type === 'earnings' ? '📋 실적 발표' :
           slide.slide_type === 'ipo' ? '🆕 공모주 일정' :
           slide.slide_type === 'signals' ? '⚡ 수급 시그널' : '📈 시황'}
        </p>
        <h2 style={{ fontSize: 'clamp(18px, 3vw, 28px)', fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>
          {slide.title_ko}
        </h2>
        <p style={{ fontSize: 'clamp(12px, 1.8vw, 16px)', opacity: 0.9, margin: 0 }}>
          {slide.subtitle_ko}
        </p>

        {/* 종목 리스트 (있으면) */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            {items.slice(0, 5).map((item, i) => (
              <span key={i} style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '13px',
                backdropFilter: 'blur(4px)',
              }}>
                {item.name} <strong style={{ color: item.change_pct > 0 ? '#fca5a5' : '#93c5fd' }}>
                  {item.change_pct > 0 ? '+' : ''}{item.change_pct?.toFixed(1)}%
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 좌우 화살표 */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="이전"
            style={{
              position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
              width: '36px', height: '36px', color: '#fff', fontSize: '18px',
              cursor: 'pointer', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <button
            onClick={next}
            aria-label="다음"
            style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
              width: '36px', height: '36px', color: '#fff', fontSize: '18px',
              cursor: 'pointer', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
        </>
      )}

      {/* 인디케이터 */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '6px', zIndex: 3,
        }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`슬라이드 ${i + 1}`}
              style={{
                width: i === current ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* CTA 링크 */}
      {slide.link_url && (
        <Link
          href={slide.link_url}
          style={{
            position: 'absolute', inset: 0, zIndex: 1,
          }}
          aria-label={slide.title_ko}
        />
      )}
    </div>
  );
}
