import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL as SITE } from '@/lib/constants';

export const metadata: Metadata = {
  title: '프리미엄 멤버십',
  description: '카더라 프리미엄 멤버십 — AI 종목 분석, 청약 알림, 광고 없는 피드, 전용 배지를 월 9,900원에 이용하세요.',
  alternates: { canonical: `${SITE}/premium` },
  openGraph: {
    title: '카더라 프리미엄 멤버십',
    description: 'AI 종목 분석 · 청약 알림 · 광고 없는 피드 · 전용 배지',
    url: `${SITE}/premium`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE}/api/og?title=${encodeURIComponent('프리미엄 멤버십')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 프리미엄' }],
  },
  other: {
    'naver:author': '카더라',
    'naver:written_time': '2026-01-15T00:00:00Z',
    'naver:updated_time': new Date().toISOString(),
    'og:updated_time': new Date().toISOString(),
    'article:section': '프리미엄',
    'article:tag': '프리미엄,멤버십,AI분석,청약알림,주식분석,부동산',
  },
};

const FREE_FEATURES = [
  { text: '주식 시세 조회 (20분 지연)', included: true },
  { text: '청약 일정 확인', included: true },
  { text: '블로그 열람', included: true },
  { text: '커뮤니티 글 작성', included: true },
  { text: '기본 등급 시스템', included: true },
];

const PREMIUM_FEATURES = [
  { icon: '🤖', title: 'AI 종목 분석 리포트', desc: '매일 아침 AI가 분석한 관심 종목 브리핑을 받아보세요' },
  { icon: '🔔', title: '청약 마감 알림', desc: '관심 지역 청약 마감 D-3, D-1 자동 푸시 알림' },
  { icon: '✨', title: '광고 없는 클린 피드', desc: '프로모션 배너 없이 순수 콘텐츠만' },
  { icon: '👑', title: '프리미엄 배지', desc: '닉네임 옆 금색 PREMIUM 배지로 신뢰도 UP' },
  { icon: '📊', title: '종목 비교 무제한', desc: '최대 10종목 동시 비교 + 히스토리 저장' },
  { icon: '📝', title: '월 1회 닉네임 변경', desc: '무료 닉네임 변경권 매달 자동 지급' },
  { icon: '⚡', title: '게시글 우선 노출', desc: '내 글이 최신 피드 상단에 우선 배치' },
  { icon: '📈', title: '실시간 급등락 알림', desc: '관심 종목 ±5% 이상 변동 시 즉시 알림' },
];

export default function PremiumPage() {
  return (
    <article style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* 브레드크럼 */}
      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>프리미엄</span>
      </nav>

      {/* OG 히어로 이미지 (검색엔진 썸네일) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/og?title=${encodeURIComponent('프리미엄 멤버십')}&design=2&category=general&subtitle=${encodeURIComponent('AI 분석 · 청약 알림 · 광고 없는 피드')}`} alt="카더라 프리미엄 멤버십 — AI 종목 분석 청약 알림 광고 없는 피드" width={1200} height={630} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderRadius: 10, marginBottom: 'var(--sp-md)', border: '1px solid var(--border)' }} loading="eager" />

      <time dateTime={new Date().toISOString()} style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--sp-md)' }}>{new Date().toLocaleDateString('ko-KR')} 기준</time>

      {/* FAQPage JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: '카더라 프리미엄 멤버십 가격은?', acceptedAnswer: { '@type': 'Answer', text: '월 9,900원입니다. AI 종목 분석 리포트, 청약 마감 알림, 광고 없는 피드, 전용 배지 등 프리미엄 기능을 이용할 수 있습니다.' } }, { '@type': 'Question', name: '프리미엄 가입 없이도 카더라를 사용할 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '네, 카더라의 주식 시세 조회, 청약 일정 확인, 블로그 열람, 커뮤니티 글 작성은 모두 무료입니다. 프리미엄은 추가 기능을 제공합니다.' } }] }) }} />
      {/* BreadcrumbList JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: SITE }, { '@type': 'ListItem', position: 2, name: '프리미엄 멤버십' }] }) }} />

      {/* 히어로 */}
      <div className="kd-card-glow" style={{
        padding: '32px 20px', textAlign: 'center', marginBottom: 'var(--sp-2xl)',
        background: 'linear-gradient(135deg, #0D1F42 0%, #081228 100%)',
        borderRadius: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(0deg,#4A9EFF 0,#4A9EFF 1px,transparent 1px,transparent 20px),repeating-linear-gradient(90deg,#4A9EFF 0,#4A9EFF 1px,transparent 1px,transparent 20px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--sp-md)' }}>👑</div>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 900, color: '#E8F2FF', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            프리미엄 멤버십
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
            AI 분석, 맞춤 알림, 클린 피드까지<br />
            투자에 진심인 당신을 위한 프리미엄
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--brand-hover)', letterSpacing: '-1px' }}>9,900</span>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 600 }}>원/월</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xl)' }}>
            하루 330원 · 언제든 해지 가능
          </div>
          <Link href="/payment?product=premium_monthly" className="kd-btn-glow" style={{
            display: 'inline-block', padding: '14px 36px', borderRadius: 14,
            fontSize: 16, textDecoration: 'none',
          }}>
            프리미엄 시작하기
          </Link>
        </div>
      </div>

      {/* 프리미엄 기능 */}
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '-0.3px' }}>
        프리미엄에서만 가능한 것들
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginBottom: 28 }}>
        {PREMIUM_FEATURES.map(f => (
          <div key={f.title} className="kd-section-card" style={{
            padding: '14px 12px', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 'var(--sp-sm)' }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)' }}>{f.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* 비교 테이블 */}
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
        무료 vs 프리미엄
      </h2>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 28 }}>
        {/* 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>기능</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'center' }}>무료</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', textAlign: 'center' }}>프리미엄</span>
        </div>
        {[
          { name: '주식 시세', free: '20분 지연', premium: '✅' },
          { name: 'AI 종목 분석', free: '❌', premium: '✅ 매일' },
          { name: '청약 알림', free: '수동 확인', premium: '✅ 자동' },
          { name: '블로그', free: '✅', premium: '✅' },
          { name: '커뮤니티', free: '✅', premium: '✅ 우선노출' },
          { name: '광고', free: '있음', premium: '없음' },
          { name: '배지', free: '기본', premium: '👑 PREMIUM' },
          { name: '닉네임 변경', free: '9,900원', premium: '월 1회 무료' },
          { name: '급등락 알림', free: '❌', premium: '✅ 실시간' },
        ].map((row, i) => (
          <div key={row.name} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px',
            padding: '10px 14px', borderBottom: i < 8 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>{row.free === '✅' ? <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', color: '#34D399', fontSize: 12, lineHeight: '16px', textAlign: 'center' }}>✓</span> : row.free === '❌' ? <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: 'rgba(248,113,113,0.15)', color: '#F87171', fontSize: 10, lineHeight: '16px', textAlign: 'center' }}>✕</span> : row.free}</span>
            <span style={{ fontSize: 12, color: 'var(--brand)', textAlign: 'center', fontWeight: 600 }}>{row.premium === '✅' ? <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: 'rgba(52,211,153,0.2)', color: '#34D399', fontSize: 12, lineHeight: '16px', textAlign: 'center' }}>✓</span> : row.premium.startsWith('✅') ? <><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: 'rgba(52,211,153,0.2)', color: '#34D399', fontSize: 12, lineHeight: '16px', textAlign: 'center' }}>✓</span> <span style={{ fontSize: 10 }}>{row.premium.replace('✅ ', '')}</span></> : row.premium}</span>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
        자주 묻는 질문
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {[
          { q: '결제는 어떻게 하나요?', a: '토스 페이먼츠를 통해 카드/간편결제로 안전하게 결제됩니다.' },
          { q: '해지는 언제든 가능한가요?', a: '네, 프로필 설정에서 언제든 해지할 수 있으며, 남은 기간은 계속 이용 가능합니다.' },
          { q: '환불 정책은 어떻게 되나요?', a: '구독 시작 후 7일 이내 미사용 시 전액 환불 가능합니다.' },
          { q: '무료 체험 기간이 있나요?', a: '현재는 무료 체험 없이 바로 구독 방식입니다. 하루 330원으로 부담 없이 시작하세요.' },
        ].map(faq => (
          <details key={faq.q} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <summary style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {faq.q}
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>+</span>
            </summary>
            <div style={{ padding: '0 14px 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      {/* 하단 CTA */}
      <div className="kd-card-glow" style={{
        padding: '24px 20px', textAlign: 'center',
        background: 'var(--bg-surface)', borderRadius: 14,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
          투자에 진심이라면, 프리미엄
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-lg)' }}>
          월 9,900원 · 하루 330원 · 언제든 해지
        </div>
        <Link href="/payment?product=premium_monthly" className="kd-btn-glow" style={{
          display: 'inline-block', padding: '13px 32px', borderRadius: 12,
          fontSize: 15, textDecoration: 'none',
        }}>
          프리미엄 시작하기
        </Link>
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: '카더라 프리미엄 멤버십',
        description: 'AI 종목 분석, 청약 알림, 광고 없는 피드, 전용 배지',
        offers: {
          '@type': 'Offer',
          price: '9900',
          priceCurrency: 'KRW',
          availability: 'https://schema.org/InStock',
          url: `${SITE}/premium`,
        },
        brand: { '@type': 'Organization', name: '카더라' },
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE },
          { '@type': 'ListItem', position: 2, name: '프리미엄' },
        ],
      }) }} />
    </article>
  );
}