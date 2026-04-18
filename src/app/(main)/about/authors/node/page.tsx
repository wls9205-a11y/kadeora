import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL, BIZ_OWNER } from '@/lib/constants';

const AUTHOR_NAME = BIZ_OWNER; // 노영진
const AUTHOR_ROLE = '카더라 설립자 · 부동산·주식 데이터 분석';
const AUTHOR_BIO =
  '부산에서 카더라(kadeora.app)를 설립·운영하며 국토교통부·금융감독원·한국거래소 등 공공 데이터를 기반으로 아파트 청약·실거래가, 주식 시세·재무 지표를 10년간 분석해왔다. 데이터 파이프라인 설계, AI 분석 모델 프롬프트 엔지니어링, SEO/GEO 전략을 담당.';
const AUTHOR_REGION = '부산';

// TODO: Node가 실제 프로필 사진 URL을 /images/author-node.jpg로 업로드하면 placeholder 대체.
const AUTHOR_IMAGE = `${SITE_URL}/icons/icon-512.png`;

export const metadata: Metadata = {
  title: `${AUTHOR_NAME} (카더라 설립자) | 카더라`,
  description: AUTHOR_BIO.slice(0, 160),
  alternates: { canonical: `${SITE_URL}/about/authors/node` },
  openGraph: {
    title: `${AUTHOR_NAME} — 카더라 설립자`,
    description: AUTHOR_BIO.slice(0, 160),
    url: `${SITE_URL}/about/authors/node`,
    siteName: '카더라',
    type: 'profile',
    images: [{ url: AUTHOR_IMAGE, width: 512, height: 512 }],
  },
};

export default function AuthorNodePage() {
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR_NAME,
    url: `${SITE_URL}/about/authors/node`,
    image: AUTHOR_IMAGE,
    jobTitle: AUTHOR_ROLE,
    description: AUTHOR_BIO,
    worksFor: {
      '@type': 'Organization',
      name: '카더라',
      url: SITE_URL,
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressRegion: AUTHOR_REGION,
    },
    knowsAbout: [
      '부동산 투자',
      '아파트 청약',
      '재개발 재건축',
      '실거래가 분석',
      '주식 투자',
      'AI 종목 분석',
      '재테크',
    ],
    sameAs: [] as string[], // Node가 공식 SNS 확보 시 채워넣을 자리
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: '소개', item: `${SITE_URL}/about` },
      { '@type': 'ListItem', position: 3, name: '저자', item: `${SITE_URL}/about/authors` },
      { '@type': 'ListItem', position: 4, name: AUTHOR_NAME },
    ],
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/about" style={{ color: 'inherit', textDecoration: 'none' }}>소개</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/about/authors" style={{ color: 'inherit', textDecoration: 'none' }}>저자</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <span>{AUTHOR_NAME}</span>
      </nav>

      <article itemScope itemType="https://schema.org/Person">
        <header
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            padding: 16,
            borderRadius: 'var(--radius-card)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'var(--brand-bg)',
              color: 'var(--brand)',
              fontSize: 32,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {AUTHOR_NAME.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 itemProp="name" style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {AUTHOR_NAME}
            </h1>
            <div itemProp="jobTitle" style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {AUTHOR_ROLE}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>거주: {AUTHOR_REGION}</div>
          </div>
        </header>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>소개</h2>
          <p itemProp="description" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            {AUTHOR_BIO}
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>전문 영역</h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            <li>부동산 청약·분양 (공공 데이터 기반)</li>
            <li>아파트 실거래가·시세 분석</li>
            <li>재개발/재건축 정비사업 트래킹</li>
            <li>KOSPI/KOSDAQ/US 주식 펀더멘털 분석</li>
            <li>AI 기반 종목 분석·SEO 콘텐츠 자동화</li>
          </ul>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>편집 원칙</h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            <li>모든 수치는 공공 데이터 출처와 수집일을 명시한다.</li>
            <li>YMYL(투자·금융) 글에는 투자자문이 아님을 고지한다.</li>
            <li>AI 자동 생성 글은 별도로 식별·태깅한다.</li>
          </ul>
        </section>

        <section>
          <Link
            href="/blog"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {AUTHOR_NAME}이 집필·편집한 글 보기 →
          </Link>
        </section>
      </article>
    </div>
  );
}
