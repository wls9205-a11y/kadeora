import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '카더라 저자 소개 | 카더라',
  description: '카더라 블로그를 집필하는 저자·편집부 소개. 부동산·주식·재테크 데이터 분석 전문.',
  alternates: { canonical: `${SITE_URL}/about/authors` },
  openGraph: {
    title: '카더라 저자 소개',
    description: '부동산·주식·재테크 데이터 분석 전문 저자진',
    url: `${SITE_URL}/about/authors`,
    siteName: '카더라',
    type: 'website',
  },
};

const AUTHORS = [
  {
    slug: 'node',
    name: '노영진',
    role: '카더라 설립자 · 부동산·주식 데이터 분석',
    bio: '부동산·주식 공공데이터 10년 분석 경험. 카더라의 데이터 파이프라인·AI 분석 모델 설계.',
  },
];

export default function AuthorListPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: '카더라 저자 소개',
            url: `${SITE_URL}/about/authors`,
            hasPart: AUTHORS.map((a) => ({
              '@type': 'Person',
              name: a.name,
              jobTitle: a.role,
              url: `${SITE_URL}/about/authors/${a.slug}`,
            })),
          }),
        }}
      />
      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/about" style={{ color: 'inherit', textDecoration: 'none' }}>소개</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <span>저자</span>
      </nav>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>저자 소개</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
        카더라 블로그는 실명 저자와 AI 편집부가 함께 작성합니다. 데이터 기반 분석과 공공 출처를 우선합니다.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {AUTHORS.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/about/authors/${a.slug}`}
              style={{
                display: 'block',
                padding: 16,
                borderRadius: 'var(--radius-card)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>{a.role}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.bio}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
