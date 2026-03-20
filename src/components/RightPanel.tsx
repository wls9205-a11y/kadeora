'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const GRADES = [
  { emoji: '🌱', title: '새싹', pts: '0' }, { emoji: '📡', title: '정보통', pts: '100' },
  { emoji: '🏘️', title: '동네어른', pts: '500' }, { emoji: '🏠', title: '소문난집', pts: '1.5K' },
  { emoji: '⚡', title: '인플루언서', pts: '3K' }, { emoji: '🔥', title: '빅마우스', pts: '6K' },
  { emoji: '💎', title: '찐고수', pts: '15K' }, { emoji: '🌟', title: '전설', pts: '30K' },
  { emoji: '👑', title: '신의경지', pts: '60K' }, { emoji: '🚀', title: '카더라신', pts: '∞' },
];

const FALLBACK = ['삼성전자', '아파트 청약', '코스피', '엔비디아', '테슬라'];

export default function RightPanel() {
  const [trending, setTrending] = useState<{ keyword: string }[]>([]);
  const [gradeOpen, setGradeOpen] = useState(false);

  useEffect(() => {
    fetch('/api/search/trending').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.keywords?.length) setTrending(d.keywords.slice(0, 5)); })
      .catch(() => {});
  }, []);

  const display = trending.length > 0 ? trending : FALLBACK.map(k => ({ keyword: k }));

  return (
    <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 72, height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
      {/* 인기 검색어 (5개) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>인기 검색어</div>
        {display.map((item, i) => (
          <Link key={i} href={`/search?q=${encodeURIComponent(item.keyword)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '4px 0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 14, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)' }}>{i + 1}</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keyword}</span>
          </Link>
        ))}
      </div>

      {/* 등급 안내 (접힌 상태 기본) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <button onClick={() => setGradeOpen(v => !v)} style={{
          width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
        }}>
          등급 안내 <span style={{ fontSize: 10 }}>{gradeOpen ? '▲' : '▼'}</span>
        </button>
        {gradeOpen && (
          <div style={{ padding: '0 14px 12px' }}>
            {GRADES.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12 }}>
                <span>{g.emoji}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{g.title}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 10 }}>{g.pts}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 푸터 정보 */}
      <div style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <Link href="/guide" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>가이드</Link>
        {' · '}
        <Link href="/terms" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>이용약관</Link>
        {' · '}
        <Link href="/privacy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>개인정보</Link>
        <div style={{ marginTop: 4 }}>(주)카더라 · 사업자 278-57-00801</div>
      </div>
    </div>
  );
}
