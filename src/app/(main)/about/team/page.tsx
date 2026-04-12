import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: '카더라 팀 소개',
  description: '카더라를 만드는 사람들. 부동산·주식 데이터 분석 전문가 팀이 매일 업데이트합니다.',
  alternates: { canonical: `${SITE_URL}/about/team` },
  openGraph: {
    title: '카더라 팀 소개', description: '부동산·주식 데이터 분석 전문가 팀',
    url: `${SITE_URL}/about/team`, siteName: '카더라', locale: 'ko_KR', type: 'profile',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('카더라 팀')}&design=2`, width: 1200, height: 630 }],
  },
  other: {
    'naver:author': '카더라', 'naver:site_name': '카더라',
    'naver:written_time': '2024-06-01T00:00:00Z',
    'naver:updated_time': new Date().toISOString(),
    'og:updated_time': new Date().toISOString(),
  },
};

const TEAM = [
  {
    name: '노영진',
    role: '대표 / 풀스택 개발',
    expertise: ['Next.js', 'Supabase', '부동산 데이터 분석', 'SEO'],
    bio: '카더라의 창업자이자 개발자. 대한민국 부동산·주식 정보를 누구나 쉽게 접근할 수 있도록 데이터 기반 플랫폼을 구축하고 있습니다.',
    links: { email: 'kadeora.app@gmail.com' },
  },
];

export default function TeamPage() {
  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'AboutPage',
        name: '카더라 팀 소개',
        mainEntity: {
          '@type': 'Organization', name: '카더라', url: SITE_URL,
          founder: TEAM.map(m => ({
            '@type': 'Person', name: m.name, jobTitle: m.role,
            description: m.bio, knowsAbout: m.expertise,
            worksFor: { '@type': 'Organization', name: '카더라', url: SITE_URL },
          })),
          address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: '부산광역시', addressLocality: '연제구', streetAddress: '연동로 27, 405호' },
        },
      })}} />

      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span> › </span>
        <span>팀 소개</span>
      </nav>

      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4 }}>카더라 팀</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-xl)' }}>
        대한민국 부동산·주식 데이터를 매일 분석하고 업데이트하는 팀입니다.
      </p>

      {TEAM.map((m, i) => (
        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 800 }}>
              {m.name[0]}
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{m.name}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-blue)' }}>{m.role}</div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px' }}>{m.bio}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {m.expertise.map(e => (
              <span key={e} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-xl)', background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontWeight: 600 }}>{e}</span>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 'var(--sp-xl)', padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 8 }}>카더라에 대해</h2>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          카더라는 주식 시세, 아파트 청약·분양·미분양·재개발·실거래가 정보, 투자 블로그, 커뮤니티를 하나의 앱에서 제공하는 대한민국 소리소문 정보 커뮤니티입니다. 
          국토교통부, 한국부동산원, 청약홈 등 공공 데이터를 실시간 수집·분석하여 누구나 쉽게 접근할 수 있는 데이터 기반 서비스를 제공합니다.
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 8 }}>
          사업자등록번호: 278-57-00801 | 부산광역시 연제구 연동로 27, 405호
        </p>
      </div>

      <ShareButtons title="카더라 팀 소개" postId="about-team" />
    </article>
  );
}
