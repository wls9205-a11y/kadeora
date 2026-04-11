'use client';
import { useEffect, useRef, useState } from 'react';

interface Props { category: string; slug: string; userCount?: number; }

export default function BlogMidCTA({ category, slug, userCount = 66 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [dismissed]);

  useEffect(() => {
    if (visible) {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'cta_view', cta_name: 'blog_mid_cta', category }) }).catch(() => {});
    }
  }, [visible, category]);

  if (dismissed) return null;

  const msg = { apt: '이 분석이 유용하셨다면, 청약 알림도 받아보세요', stock: '이 분석이 유용하셨다면, 종목 알림도 받아보세요', finance: '이 분석이 유용하셨다면, 투자 인사이트를 매일 받아보세요' }[category] || '이 분석이 유용하셨다면, 더 많은 분석을 받아보세요';
  const loginUrl = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=blog_mid_cta`;

  return (
    <div ref={ref} style={{ margin: '28px 0', padding: '16px 18px', borderRadius: 12, background: 'rgba(59,123,246,0.04)', border: '1px solid rgba(59,123,246,0.12)', position: 'relative', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.4s, transform 0.4s' }}>
      <button onClick={() => setDismissed(true)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{msg}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={loginUrl} onClick={() => { fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'cta_click', cta_name: 'blog_mid_cta', category }) }).catch(() => {}); }} style={{ padding: '8px 16px', borderRadius: 8, background: '#FEE500', color: '#191919', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 512 512" fill="#191919"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z"/></svg>
          무료로 시작하기
        </a>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>✅ {userCount.toLocaleString()}명 사용 중</span>
      </div>
    </div>
  );
}
