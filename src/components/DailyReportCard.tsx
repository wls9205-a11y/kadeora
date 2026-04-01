'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const ZODIAC_ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
const ZODIAC_EMOJI: Record<string, string> = { '쥐': '🐭', '소': '🐮', '호랑이': '🐯', '토끼': '🐰', '용': '🐲', '뱀': '🐍', '말': '🐴', '양': '🐑', '원숭이': '🐵', '닭': '🐔', '개': '🐶', '돼지': '🐷' };

function getZodiac(year: number): string {
  const idx = (year - 4) % 12;
  return ZODIAC_ANIMALS[idx >= 0 ? idx : idx + 12];
}

function getDailyFortune(animal: string, seed: number): string {
  const fortunes: Record<string, string[]> = {
    '쥐': ['금전운이 좋은 날입니다. 소액 투자에 행운이.', '인간관계에서 좋은 소식이 올 수 있어요.', '새로운 기회가 찾아올 수 있는 날.'],
    '소': ['꾸준함이 빛을 발하는 날. 장기 투자 유리.', '건강에 신경 쓰면 좋은 하루.', '직장에서 인정받을 수 있는 기회.'],
    '호랑이': ['과감한 결정이 좋은 결과를 가져올 날.', '운동이나 야외활동이 기운을 줄 거예요.', '리더십을 발휘할 기회가 옵니다.'],
    '토끼': ['예술적 감각이 빛나는 날. 창의적 아이디어에 주목.', '가족과의 시간이 행복을 가져다줘요.', '부동산 관련 좋은 소식이 있을 수 있어요.'],
    '용': ['대담한 계획을 실행하기 좋은 날.', '주변 사람들의 도움으로 일이 잘 풀려요.', '재테크에 대한 좋은 영감이 떠오를 수 있어요.'],
    '뱀': ['직감이 날카로운 날. 투자 판단을 믿으세요.', '학습이나 자기개발에 좋은 에너지.', '조용히 정리하는 시간이 필요한 날.'],
    '말': ['활발한 에너지가 넘치는 날! 적극적으로 움직이세요.', '새로운 사람을 만나면 좋은 인연이 될 수 있어요.', '단기 수익 기회를 잘 포착하세요.'],
    '양': ['온화한 대인관계가 좋은 결과를 가져와요.', '작은 기부나 나눔이 큰 행운으로 돌아올 날.', '부동산 시장에 눈여겨볼 물건이 있을 수 있어요.'],
    '원숭이': ['재치와 유머가 빛나는 날. 소통에 강점.', '새로운 부업이나 수입원을 찾기 좋은 타이밍.', '숫자에 강한 날. 계산이 정확해요.'],
    '닭': ['꼼꼼한 분석이 성과를 가져오는 날.', '아침 일찍 시작하면 좋은 일이 생겨요.', '저축이나 절약 습관이 큰 도움이 되는 날.'],
    '개': ['충성스러운 인간관계가 보답받는 날.', '건강검진이나 보험 점검하기 좋은 시기.', '안정적인 투자가 마음의 평화를 줄 거예요.'],
    '돼지': ['풍요로운 에너지가 감도는 날! 맛있는 것도 OK.', '예상치 못한 금전운이 있을 수 있어요.', '가정의 평화가 모든 것의 기반이 되는 날.'],
  };
  const arr = fortunes[animal] || fortunes['쥐'];
  return arr[seed % arr.length];
}

export default function DailyReportCard() {
  const [region, setRegion] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [zodiacYear, setZodiacYear] = useState<number | null>(null);
  const [showZodiac, setShowZodiac] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRegion(localStorage.getItem('daily_region') || '서울');
      const saved = localStorage.getItem('kd_birth_year');
      if (saved) setZodiacYear(parseInt(saved));
    }
    // AI 브리핑 가져오기
    const sb = createSupabaseBrowser() as any;
    sb.from('stock_daily_briefing').select('summary').eq('market', 'KR').order('briefing_date', { ascending: false }).limit(1)
      .then((r: any) => { if (r.data?.[0]?.summary) setBriefing(r.data[0].summary.slice(0, 300)); });
  }, []);

  if (!region) return null;

  const now = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const daySeed = now.getFullYear() * 366 + (now.getMonth() + 1) * 31 + now.getDate();

  return (
    <div style={{ marginBottom: 10 }}>
      {/* 데일리 리포트 */}
      <Link href={`/daily/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-card)',
          background: 'linear-gradient(145deg, rgba(212,168,83,0.07) 0%, rgba(184,148,46,0.02) 100%)',
          border: '1px solid rgba(212,168,83,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: briefing ? 6 : 0 }}>
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
          {/* AI 브리핑 첫줄 */}
          {briefing && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '6px 0 0', borderTop: '1px solid rgba(212,168,83,0.1)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
              💬 {briefing}
            </div>
          )}
        </div>
      </Link>

      {/* 오늘의 운세 */}
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--radius-card)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showZodiac ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🔮</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 운세</span>
          </div>
          {!showZodiac ? (
            <button onClick={() => setShowZodiac(true)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}>
              확인하기 →
            </button>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{now.getMonth() + 1}/{now.getDate()} 기준</span>
          )}
        </div>

        {showZodiac && (
          <>
            {!zodiacYear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>출생연도</span>
                <select
                  onChange={(e) => {
                    const y = parseInt(e.target.value);
                    setZodiacYear(y);
                    localStorage.setItem('kd_birth_year', String(y));
                  }}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 12, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value="">연도 선택</option>
                  {Array.from({ length: 60 }, (_, i) => 2006 - i).map(y => (
                    <option key={y} value={y}>{y}년 ({ZODIAC_EMOJI[getZodiac(y)]} {getZodiac(y)}띠)</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{ZODIAC_EMOJI[getZodiac(zodiacYear)]}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{getZodiac(zodiacYear)}띠 ({zodiacYear}년생)</span>
                  <button onClick={() => { setZodiacYear(null); localStorage.removeItem('kd_birth_year'); }} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>변경</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '4px 0' }}>
                  {getDailyFortune(getZodiac(zodiacYear), daySeed)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
