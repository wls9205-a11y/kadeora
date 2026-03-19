'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const GRADES = [
  { grade: 1, emoji: '🌱', title: '새싹', points: '0' },
  { grade: 2, emoji: '📢', title: '정보통', points: '100' },
  { grade: 3, emoji: '🏘', title: '동네어른', points: '500' },
  { grade: 4, emoji: '⭐', title: '소문난집', points: '1,500' },
  { grade: 5, emoji: '💫', title: '인플루언서', points: '3,000' },
  { grade: 6, emoji: '🦊', title: '빅마우스', points: '6,000' },
  { grade: 7, emoji: '🔥', title: '찐고수', points: '15,000' },
  { grade: 8, emoji: '👑', title: '전설', points: '30,000' },
  { grade: 9, emoji: '🌟', title: '신의경지', points: '60,000' },
  { grade: 10, emoji: '🚀', title: '카더라신', points: '∞' },
];

const FALLBACK = ['삼성전자', '아파트 청약', '부산 맛집', '코스피', '서울 핫플', '엔비디아', '강남 부동산', '테슬라', '제주 여행', '주식 추천'];

export default function RightPanel() {
  const [trending, setTrending] = useState<{ keyword: string }[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/search/trending').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.keywords?.length) setTrending(d.keywords.slice(0, 10)); })
      .catch(() => {});
  }, []);

  const display = trending.length > 0 ? trending : FALLBACK.map(k => ({ keyword: k }));

  return (
    <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 72, height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
      {/* 실시간 인기 검색어 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🔍 인기 검색어</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {display.map((item, i) => (
            <Link key={i} href={`/search?q=${encodeURIComponent(item.keyword)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '3px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 16, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)' }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keyword}</span>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>최근 7일 기준</div>
      </div>

      {/* 등급 안내 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>⭐ 등급 안내</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(showAll ? GRADES : GRADES.slice(0, 5)).map(g => (
            <div key={g.grade} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <span style={{ fontSize: 14, minWidth: 20 }}>{g.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{g.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{g.points}P~</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 8, width: '100%', padding: '6px 0', background: 'var(--bg-hover)', border: 'none', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {showAll ? '접기 ▲' : '전체보기 ▼'}
        </button>
        <Link href="/grades" style={{ display: 'block', marginTop: 6, textAlign: 'center', fontSize: 11, color: 'var(--brand)', textDecoration: 'none' }}>등급 혜택 자세히 →</Link>
      </div>

      {/* 카더라 소개 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          📣 <strong style={{ color: 'var(--text-primary)' }}>카더라</strong>는<br />대한민국 소리소문<br />정보 커뮤니티입니다.
        </div>
        <Link href="/guide" style={{ display: 'block', marginTop: 8, padding: '7px 0', textAlign: 'center', background: 'var(--brand)', color: 'var(--text-inverse)', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          📖 가이드북 보기
        </Link>
      </div>
    </div>
  );
}
