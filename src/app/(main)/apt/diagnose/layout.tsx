import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '청약 가점 계산기',
  description: '내 청약 가점을 자동 계산하세요. 무주택기간·부양가족·청약통장 기간별 점수를 입력하면 총점과 예상 당첨 가능성을 알려드립니다.',
  alternates: { canonical: `${SITE_URL}/apt/diagnose` },
  openGraph: {
    title: '청약 가점 계산기 — 카더라',
    description: '무주택기간·부양가족·청약통장 가점 자동 계산',
    url: `${SITE_URL}/apt/diagnose`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('청약 가점 계산기')}&design=2&subtitle=${encodeURIComponent('무주택·부양가족·통장 가점 자동 계산')}`, width: 1200, height: 630, alt: '카더라 청약 가점 계산기' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('청약 가점 계산기')}&category=apt`, width: 630, height: 630, alt: '카더라 청약 가점 계산기' },
    ],
  },
  twitter: { card: 'summary_large_image' as const, title: '청약 가점 계산기', description: '무주택기간·부양가족·청약통장 가점 자동 계산' },
  other: {
    'naver:author': '카더라 부동산팀',
    'naver:written_time': '2026-01-15T00:00:00Z',
    'naver:updated_time': new Date().toISOString(),
    'dg:plink': `${SITE_URL}/apt/diagnose`,
    'article:section': '부동산',
    'article:tag': '청약,가점,계산기,무주택,부양가족,청약통장',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebApplication',
        name: '카더라 청약 가점 계산기',
        url: `${SITE_URL}/apt/diagnose`,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        description: '무주택기간, 부양가족 수, 청약통장 가입기간을 입력하면 총 가점과 예상 당첨 가능성을 계산해줍니다.',
        provider: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.diagnose-result'] },
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '청약 가점 만점은 몇 점인가요?', acceptedAnswer: { '@type': 'Answer', text: '청약 가점 만점은 84점입니다. 무주택기간 최대 32점, 부양가족 수 최대 35점, 청약통장 가입기간 최대 17점으로 구성됩니다.' } },
          { '@type': 'Question', name: '무주택 기간은 어떻게 계산하나요?', acceptedAnswer: { '@type': 'Answer', text: '만 30세부터 무주택 기간이 산정됩니다. 30세 이전에 혼인한 경우 혼인신고일부터 계산합니다. 1년 미만 2점, 이후 1년당 2점씩 추가되어 최대 15년 이상 32점입니다.' } },
          { '@type': 'Question', name: '부양가족 기준은 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: '부양가족은 세대원 중 본인을 제외한 직계존속(3년 이상 동일 주민등록), 배우자, 직계비속(미혼)이 해당됩니다. 0명 5점, 1명 10점, 2명 15점, 6명 이상 35점(만점)입니다.' } },
        ],
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
          { '@type': 'ListItem', position: 3, name: '청약 가점 계산기' },
        ],
      })}} />
      {children}
    </>
  );
}
