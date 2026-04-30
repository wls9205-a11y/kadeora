import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  // s212 P0-B: template 가 '| 카더라' 자동 추가
  title: '카더라 편집부 소개',
  description: '카더라 블로그를 제작하는 분야별 편집팀 소개. 부동산·주식·재테크·데이터 분석 전문.',
  alternates: { canonical: `${SITE_URL}/about/authors` },
  openGraph: {
    title: '카더라 편집부 소개',
    description: '부동산·주식·재테크 데이터 기반 분석팀',
    url: `${SITE_URL}/about/authors`,
    siteName: '카더라',
    type: 'website',
  },
};

const TEAMS = [
  {
    name: '카더라 부동산팀',
    focus: '아파트 청약·분양·실거래가·재개발·재건축',
    sources: '국토교통부 실거래가, 청약홈, 부산시·서울시 도시정비 고시',
    scope: '전국 34,500+ 단지 · 495K+ 실거래 기록',
  },
  {
    name: '카더라 주식팀',
    focus: '국내외 종목 분석·배당·실적·공시',
    sources: 'KRX(KOSPI·KOSDAQ), NYSE·NASDAQ, DART 공시, FRED 거시지표',
    scope: '1,805개 종목 · AI 종목 분석 · 펀더멘털·수급',
  },
  {
    name: '카더라 재테크팀',
    focus: '대출·세금·절세·연금·ETF 가이드',
    sources: '금융감독원, 국세청, 기획재정부 보도자료',
    scope: '실생활 투자·세금 전략 · 연령·소득대별 계산기',
  },
  {
    name: '카더라 데이터팀',
    focus: '데이터 파이프라인·SEO·AI 분석 모델',
    sources: '공공데이터 ETL, AI 자동 분석 (Claude, Anthropic)',
    scope: '콘텐츠 자동화 · 품질 검증 · E-E-A-T 시그널',
  },
  {
    name: '카더라 생활팀',
    focus: '부동산·금융 관련 생활정보 가이드',
    sources: '정부 공식 가이드, 카더라 사용자 질의',
    scope: '절차·서류·실무 Q&A',
  },
  {
    name: '카더라 투자팀',
    focus: '시나리오 투자 분석·포트폴리오',
    sources: '시장 리포트, 외국인·기관 수급, 테마주',
    scope: '중·장기 투자 아이디어 · 리스크 점검',
  },
  {
    name: '카더라 부동산분석팀',
    focus: '지역별 심화 분석·시세 예측·재건축 트래킹',
    sources: '한국부동산원, 시군구 고시, 정비조합 공개자료',
    scope: '대형 이벤트 단지 7단계 라이프사이클 추적',
  },
];

export default function AuthorListPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: '카더라 편집부 소개',
    url: `${SITE_URL}/about/authors`,
    about: {
      '@type': 'Organization',
      name: '카더라',
      url: SITE_URL,
      department: TEAMS.map((t) => ({
        '@type': 'Organization',
        name: t.name,
        description: t.focus,
      })),
    },
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="breadcrumb" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <Link href="/about" style={{ color: 'inherit', textDecoration: 'none' }}>소개</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
        <span>편집부</span>
      </nav>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>카더라 편집부</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
        카더라 블로그는 분야별 편집팀이 공공데이터·공시·시장 자료를 기반으로 작성합니다.
        모든 분석 수치는 출처와 수집일을 명시하며, 투자자문이 아닌 정보 제공 목적입니다.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TEAMS.map((t) => (
          <li
            key={t.name}
            style={{
              padding: 16,
              borderRadius: 'var(--radius-card)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</div>
            <div style={{ fontSize: 12, color: 'var(--brand)', margin: '4px 0 8px', fontWeight: 600 }}>{t.focus}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-tertiary)' }}>데이터 출처:</strong> {t.sources}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 3 }}>
              <strong style={{ color: 'var(--text-tertiary)' }}>담당 범위:</strong> {t.scope}
            </div>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 24, lineHeight: 1.6 }}>
        AI 자동 생성 글은 author_role에 &quot;(AI 자동 생성)&quot;로 명시됩니다. 데이터 기반 팩트체크 후 게시됩니다.
      </p>
    </div>
  );
}
