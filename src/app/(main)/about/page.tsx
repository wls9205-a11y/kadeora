import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, CONTACT_EMAIL, CONTACT_PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: '카더라 소개 — 부동산·주식 정보 플랫폼',
  description: '카더라(kadeora.app)는 아파트 청약·재개발·실거래가, 주식 시세·AI 종목 분석, 투자 커뮤니티를 한곳에서 제공하는 대한민국 부동산·주식 정보 플랫폼입니다.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: '카더라 소개 — 부동산·주식 정보 플랫폼',
    description: '아파트 청약·재개발, 주식 시세·AI 종목 분석, 투자 커뮤니티를 한곳에서.',
    url: `${SITE_URL}/about`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('카더라 소개')}&subtitle=${encodeURIComponent('부동산·주식 정보 플랫폼')}&design=2`, width: 1200, height: 630 }],
  },
};

const FEATURES = [
  { icon: '📈', title: '실시간 주식 시세', desc: 'KOSPI·KOSDAQ·NYSE·NASDAQ 728개 종목 실시간 시세, 섹터 히트맵, AI 시황 브리핑' },
  { icon: '🏗️', title: '아파트 청약·재개발', desc: '전국 청약 일정, 재개발·재건축 현황, 미분양 추적, 분양 컨설턴트 연결' },
  { icon: '🏘️', title: '단지백과', desc: '전국 34,500+ 아파트 단지별 연차 실거래가 비교, 시세 추이 분석' },
  { icon: '🤖', title: 'AI 종목 분석', desc: 'Claude AI 기반 주식 종목 심층 분석 리포트 (Pro 회원)' },
  { icon: '📝', title: '데이터 블로그', desc: '18,000+ 편의 부동산·주식 데이터 분석 블로그, 종목/아파트 비교 시리즈' },
  { icon: '💬', title: '투자 커뮤니티', desc: '실시간 피드, 종목 토론방, 지역별 부동산 정보 공유' },
  { icon: '🧮', title: '투자 계산기', desc: '청약 가점, 대출 이자, 수익률, 세금 등 20+ 종 금융 계산기' },
  { icon: '🔔', title: '실시간 알림', desc: '청약 마감, 급등주, 미분양 업데이트 카카오톡·푸시 알림' },
];

const STATS = [
  { value: '18,000+', label: '블로그 포스트' },
  { value: '728', label: '추적 종목 수' },
  { value: '34,500+', label: '아파트 단지' },
  { value: '95+', label: '자동화 크론' },
];

export default function AboutPage() {
  return (
    <>
      {/* JSON-LD: AboutPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: '카더라 소개',
        description: '카더라(kadeora.app)는 대한민국 부동산·주식 정보 플랫폼입니다.',
        url: `${SITE_URL}/about`,
        mainEntity: {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: '카더라',
          alternateName: ['KADEORA', 'kadeora.app', '카더라 부동산', '카더라 주식', '카더라 앱', '카더라 청약'],
          url: SITE_URL,
          logo: `${SITE_URL}/icons/icon-512.png`,
          description: '부동산·주식 정보 플랫폼 — 아파트 청약, 재개발, 주식 시세, AI 종목 분석',
          foundingDate: '2024',
          founder: { '@type': 'Person', name: '노영진' },
          address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: '부산광역시', addressLocality: '연제구', streetAddress: '연동로 27, 405호' },
          contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: CONTACT_EMAIL, telephone: `+82-${CONTACT_PHONE}` },
          sameAs: [],
          knowsAbout: ['부동산 투자', '주식 투자', '아파트 청약', '재개발', 'AI 주식 분석'],
        },
      }) }} />

      <div id="main-content" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px 80px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.3 }}>
            카더라
            <span style={{ display: 'block', fontSize: 16, fontWeight: 500, color: 'var(--text-dim)', marginTop: 8 }}>
              부동산·주식 정보 플랫폼
            </span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
            <strong>카더라(kadeora.app)</strong>는 &ldquo;~라 카더라&rdquo;라는 부산 사투리에서 이름을 따온
            대한민국 부동산·주식 정보 플랫폼입니다.
            아파트 청약·재개발·실거래가부터 주식 시세·AI 종목 분석, 투자 커뮤니티까지
            흩어진 투자 정보를 한곳에서 제공합니다.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 48 }} className="mc-g2">
          {STATS.map(s => (
            <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>주요 기능</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 48 }} className="mc-g1">
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Brand Story */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>카더라란?</h2>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 48, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 12px' }}>
            &ldquo;~라 카더라&rdquo;는 경상도 방언으로 &ldquo;~라고 하더라&rdquo;의 줄임말입니다.
            사람들 사이에서 자연스럽게 퍼지는 정보, 아는 사람만 아는 소식 — 그것이 카더라의 시작입니다.
          </p>
          <p style={{ margin: '0 0 12px' }}>
            부산에서 시작한 카더라는 부동산과 주식이라는 두 가지 핵심 투자 영역의 정보를
            데이터 기반으로 정리하고, AI 분석과 커뮤니티 토론을 결합하여
            개인 투자자가 더 나은 의사결정을 할 수 있도록 돕습니다.
          </p>
          <p style={{ margin: 0 }}>
            매일 자동으로 업데이트되는 18,000편 이상의 데이터 분석 블로그,
            728개 종목의 실시간 시세, 34,500개 아파트 단지의 실거래가 —
            카더라에서 확인하세요.
          </p>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <Link href="/stock" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'var(--brand)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            📈 주식 시세 보기
          </Link>
          <Link href="/apt" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            🏗️ 부동산 정보 보기
          </Link>
          <Link href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            📝 블로그 읽기
          </Link>
        </div>

        {/* Contact */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 4px' }}>상호명: 카더라 | 대표자: 노영진 | 사업자등록번호: 278-57-00801</p>
          <p style={{ margin: '0 0 4px' }}>사업장: 부산광역시 연제구 연동로 27, 405호</p>
          <p style={{ margin: 0 }}>이메일: {CONTACT_EMAIL} | 전화: {CONTACT_PHONE}</p>
        </div>
      </div>
    </>
  );
}
