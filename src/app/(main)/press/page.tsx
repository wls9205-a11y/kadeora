import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '프레스 킷',
  description: '카더라 미디어 키트. 로고, 서비스 소개, 데이터 인용 가이드를 제공합니다.',
  alternates: { canonical: `${SITE_URL}/press` },
  openGraph: { title: '카더라 프레스 킷', description: '미디어 키트 + 데이터 인용 가이드', url: `${SITE_URL}/press`, siteName: '카더라', locale: 'ko_KR', type: 'website' },
};

const STATS = [
  { label: '부동산 현장 데이터', value: '2,900+', desc: '청약·분양·재개발·미분양' },
  { label: '아파트 단지백과', value: '34,000+', desc: '전국 아파트 실거래가' },
  { label: '주식 종목', value: '728', desc: 'KOSPI·KOSDAQ·NYSE·NASDAQ' },
  { label: '블로그 포스트', value: '21,000+', desc: '투자 데이터 분석' },
  { label: '무료 계산기', value: '145종', desc: '세금·부동산·주식·대출' },
];

export default function PressPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '프레스' }] }) }} />

    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span> › </span><span>프레스 킷</span>
      </nav>

      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4 }}>프레스 킷</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xl)' }}>
        카더라 서비스 소개 및 미디어 활용 가이드
      </p>

      <section style={{ marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 12 }}>서비스 한줄 소개</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0, fontWeight: 600 }}>
            &ldquo;카더라는 주식 시세, 아파트 청약·실거래가, 무료 계산기, 투자 블로그를 하나의 앱에서 제공하는 대한민국 부동산·주식 데이터 플랫폼입니다.&rdquo;
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 12 }}>핵심 수치</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--brand)' }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 12 }}>데이터 인용 가이드</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 12px' }}>
            카더라의 데이터를 기사, 블로그, 유튜브 등에서 인용하실 때 아래 형식을 사용해 주세요.
          </p>
          <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.6 }}>
            출처: 카더라(kadeora.app)<br/>
            링크: https://kadeora.app/[해당 페이지 경로]
          </div>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 10 }}>
            데이터 출처 표기 시 카더라 링크를 포함해 주시면, 더 많은 무료 데이터를 제공하는 데 큰 도움이 됩니다.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 12 }}>데이터 출처</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          카더라는 국토교통부, 한국부동산원, 청약홈(applyhome.co.kr), 한국거래소, Yahoo Finance 등의 공공·공개 데이터를 수집·분석하여 제공합니다. 
          카더라 자체 분석 데이터(평당가 계산, 전세가율, 가점 시뮬레이션 등)는 카더라의 독자적 산출물입니다.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 12 }}>문의</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 8px' }}>데이터 제휴, 기사 인용, 인터뷰 요청</p>
          <a href="mailto:kadeora.app@gmail.com" style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none' }}>📧 kadeora.app@gmail.com</a>
        </div>
      </section>
    </article>
  
    </>);
}
