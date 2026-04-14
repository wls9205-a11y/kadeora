'use client';
import { useEffect, useRef, useState } from 'react';
import { trackConversion } from '@/lib/track-conversion';

interface Props { category: string; slug: string; userCount?: number; }

const CONFIGS: Record<string, { icon: string; hook: string; benefits: string[] }> = {
  apt: { icon: '🏠', hook: '이 아파트 가격이 변하면 알려드릴까요?', benefits: ['실거래가 변동 즉시 알림', '청약 마감 D-day 카운트다운', '관심 지역 주간 시세 리포트'] },
  stock: { icon: '📈', hook: '이 종목 급등/급락 시 알려드릴까요?', benefits: ['관심 종목 가격 변동 알림', '목표가 도달 시 즉시 알림', 'AI 투자 의견 주간 리포트'] },
  finance: { icon: '💰', hook: '내 돈에 영향 주는 변화, 놓치지 마세요', benefits: ['금리·세법 변경 알림', '맞춤 절세 전략 리포트', '재테크 주간 브리핑'] },
  unsold: { icon: '🏗️', hook: '이 지역 미분양 변동 시 알려드릴까요?', benefits: ['미분양 세대 변동 알림', '할인 분양 소식 즉시 전달', '관심 지역 시세 추적'] },
  redev: { icon: '🔨', hook: '이 구역 단계 변경 시 알려드릴까요?', benefits: ['사업 단계 변경 즉시 알림', '구역 내 실거래가 추적', '관리처분·착공 일정 알림'] },
};

export default function BlogMidCTA({ category, slug, userCount = 80 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (dismissed) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [dismissed]);

  useEffect(() => {
    if (visible && !tracked.current) {
      tracked.current = true;
      trackConversion('cta_view', 'blog_mid_cta', { category });
    }
  }, [visible, category]);

  if (dismissed) return null;
  const cfg = CONFIGS[category] || CONFIGS.apt;
  const loginUrl = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=blog_mid_cta`;

  return (
    <div ref={ref} style={{
      margin: '24px 0', borderRadius: 'var(--radius-card)', overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(135deg, rgba(12,21,40,0.95), rgba(20,30,55,0.95))',
      border: '1px solid rgba(59,123,246,0.15)',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.4s, transform 0.4s',
    }}>
      <button onClick={() => setDismissed(true)} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, zIndex: 1 }}>×</button>
      <div style={{ padding: '20px 18px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e6e3', marginBottom: 12, lineHeight: 1.4 }}>{cfg.icon} {cfg.hook}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {cfg.benefits.map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a0aec0' }}>
              <span style={{ color: '#22c55e', fontSize: 12, flexShrink: 0 }}>✓</span>{b}
            </div>
          ))}
        </div>
        <a href={loginUrl} onClick={() => trackConversion('cta_click', 'blog_mid_cta', { category })} style={{
          display: 'flex', width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
          background: '#FEE500', color: '#191919', fontSize: 14, fontWeight: 700,
          textDecoration: 'none', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box',
        }}>
          <svg width="16" height="16" viewBox="0 0 512 512" fill="#191919"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z"/></svg>
          알림 설정하기 (무료)
        </a>
        <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>✅ {userCount.toLocaleString()}명 이용 중 · 스팸 없음 · 3초 가입</div>
      </div>
    </div>
  );
}
