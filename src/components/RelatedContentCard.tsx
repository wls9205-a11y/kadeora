'use client';
/**
 * RelatedContentCard — 관련 콘텐츠 추천 카드
 * InlineCTA("가입하세요") 대체 → 2페이지 이동 유도
 * 
 * 가입 CTA가 아니라 콘텐츠 CTA로 유저를 다른 페이지로 이동시킴
 * → 2페이지에서도 ContentGate/ActionBar 노출 → 가입 압력 누적
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trackClick } from '@/lib/analytics';

interface Props {
  type: 'blog' | 'apt' | 'stock' | 'feed';
  entityName?: string;
  showSignup?: boolean;
}

const LINKS: Record<string, { icon: string; title: string; href: string; desc: string }[]> = {
  blog: [
    { icon: '🏠', title: '부동산 청약 현황', href: '/apt', desc: '전국 청약·분양·미분양 한눈에' },
    { icon: '📈', title: '주식 시세 보기', href: '/stock', desc: '코스피·코스닥·나스닥 실시간' },
    { icon: '🎯', title: '청약 가점 계산기', href: '/apt/diagnose', desc: '내 가점으로 당첨 가능성 확인' },
  ],
  apt: [
    { icon: '📊', title: '단지백과 비교', href: '/apt/complex', desc: '34,000+ 아파트 연차별 비교' },
    { icon: '🎯', title: '청약 가점 계산기', href: '/apt/diagnose', desc: '무주택·부양가족·통장 자동 계산' },
    { icon: '📝', title: '부동산 분석 블로그', href: '/blog?category=apt', desc: 'AI 시세 전망·투자 분석' },
  ],
  stock: [
    { icon: '📊', title: '종목 비교', href: '/stock/compare', desc: '관심 종목 나란히 비교 분석' },
    { icon: '🏠', title: '부동산 정보', href: '/apt', desc: '청약·분양·미분양 현황' },
    { icon: '📝', title: '주식 분석 블로그', href: '/blog?category=stock', desc: 'AI 종목 분석·시장 전망' },
  ],
  feed: [
    { icon: '🏠', title: '부동산 현황', href: '/apt', desc: '전국 청약·분양·미분양' },
    { icon: '📈', title: '주식 시세', href: '/stock', desc: '실시간 코스피·코스닥' },
    { icon: '📝', title: '투자 블로그', href: '/blog', desc: '부동산·주식 데이터 분석' },
  ],
};

export default function RelatedContentCard({ type, entityName, showSignup }: Props) {
  const pathname = usePathname();
  const links = LINKS[type] || LINKS.blog;

  return (
    <div style={{
      marginTop: 16, padding: 14, borderRadius: 'var(--radius-card)',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
        📊 함께 보면 좋은 콘텐츠
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map((l, i) => (
          <Link key={i} href={l.href}
            onClick={() => trackClick('related_content', { from: pathname, to: l.href, type })}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)', textDecoration: 'none',
              border: '1px solid var(--border)', transition: 'border-color 0.15s',
            }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{l.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{l.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{l.desc}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>→</span>
          </Link>
        ))}
      </div>
      {showSignup && (
        <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=related_card`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginTop: 10, padding: '10px', borderRadius: 'var(--radius-md)',
            background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.12)',
            fontSize: 12, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none',
          }}>
          🔔 무료 가입하고 알림 받기
        </Link>
      )}
    </div>
  );
}
