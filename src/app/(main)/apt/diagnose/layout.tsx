import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

const TITLE = '2026 청약 가점 계산기 — 무주택·부양가족·통장 자동 계산';
const DESC = '2026년 최신 기준 청약 가점 자동 계산기. 무주택기간·부양가족 수·청약통장 가입기간(배우자 합산 포함)을 입력하면 총점 84점 기준 가점, 지역별 당첨 가능성, 맞춤 전략을 제공합니다. 주택공급규칙 별표1 기준.';
const URL = `${SITE_URL}/apt/diagnose`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ['청약 가점 계산기', '청약 점수 계산기', '청약 가점 만점', '무주택기간 계산', '부양가족 점수', '청약통장 가입기간', '배우자 통장 합산', '청약 당첨 전략', '2026 청약', '아파트 청약 가점'],
  alternates: { canonical: URL },
  openGraph: {
    title: '2026 청약 가점 계산기 — 카더라',
    description: '무주택·부양가족·통장 가점 자동 계산 + 지역별 커트라인 + 배우자 통장 합산',
    url: URL, siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('2026 청약 가점 계산기')}&design=2&subtitle=${encodeURIComponent('무주택·부양가족·통장 자동 계산 (84점 만점)')}`, width: 1200, height: 630, alt: '카더라 청약 가점 계산기' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('청약 가점 계산기')}&category=apt`, width: 630, height: 630, alt: '카더라 청약 가점 계산기' },
    ],
  },
  twitter: { card: 'summary_large_image', title: '2026 청약 가점 계산기', description: '무주택·부양가족·통장 가점 자동 계산 + 배우자 합산' },
  other: {
    'naver:author': '카더라',
    'naver:written_time': new Date().toISOString(),
    'naver:updated_time': '2026-04-05T00:00:00Z',
    'og:updated_time': '2026-04-05T00:00:00Z',
    'dg:plink': URL,
    'article:section': '부동산',
    'article:tag': '청약가점계산기,청약점수계산,무주택기간,부양가족,청약통장,배우자통장합산,청약당첨,2026청약,아파트청약,가점제',
    'article:published_time': '2026-01-15T00:00:00Z',
    'article:modified_time': '2026-04-05T00:00:00Z',
  },
};

const FAQS = [
  { q: '청약 가점 만점은 몇 점인가요?', a: '청약 가점 만점은 84점입니다. 무주택기간 최대 32점, 부양가족 수 최대 35점, 청약통장 가입기간 최대 17점으로 구성됩니다.' },
  { q: '무주택 기간은 어떻게 계산하나요?', a: '만 30세부터 무주택 기간이 산정됩니다. 30세 이전에 혼인한 경우 혼인신고일부터 계산합니다. 1년 미만 2점, 이후 1년당 2점씩 추가되어 최대 15년 이상 32점입니다.' },
  { q: '부양가족 기준은 무엇인가요?', a: '부양가족은 세대원 중 본인을 제외한 배우자, 직계존속(3년 이상 동일 주민등록), 직계비속(미혼 자녀)이 해당됩니다. 0명 5점부터 6명 이상 35점(만점)입니다.' },
  { q: '배우자 청약통장도 합산되나요?', a: '네, 2024년부터 배우자의 청약통장 가입기간이 50%까지 인정되며, 최대 3점까지 합산됩니다. 단, 본인과 배우자 합산 최대 17점입니다.' },
  { q: '만 30세 미만 미혼인데 청약 가능한가요?', a: '가능합니다. 다만 무주택기간 0점이 적용됩니다. 85㎡ 초과 추첨제나 생애최초 특별공급을 활용하는 것이 유리합니다.' },
  { q: '오피스텔 소유자도 무주택자인가요?', a: '네, 오피스텔은 건축법상 업무시설이므로 주택으로 간주되지 않습니다. 오피스텔을 소유해도 무주택자로 인정됩니다.' },
  { q: '가점을 잘못 입력하면 어떻게 되나요?', a: '당첨 취소 및 최대 1년간 청약 신청 불가 불이익이 발생합니다. 부적격 당첨의 46.3%가 가점 입력 오류입니다.' },
  { q: '분양권도 주택으로 보나요?', a: '네, 분양권 및 입주권은 주택으로 간주됩니다. 단, 상속 후 3개월 이내 지분 처분 시 무주택으로 인정됩니다.' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* WebApplication */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebApplication',
        name: '카더라 청약 가점 계산기 2026',
        url: URL,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web, iOS, Android',
        description: DESC,
        provider: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.diagnose-result', '.blog-content h2'] },
        datePublished: '2026-01-15',
        dateModified: '2026-04-05',
      })}} />

      {/* FAQPage (8개 — 리치 스니펫) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: FAQS.map(f => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      })}} />

      {/* HowTo (단계별 사용법 — 구글 리치 결과) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'HowTo',
        name: '청약 가점 계산하는 방법',
        description: '주택공급규칙 별표1 기준으로 청약 가점을 4단계로 계산합니다.',
        totalTime: 'PT2M',
        step: [
          { '@type': 'HowToStep', position: 1, name: '기본 정보 입력', text: '만 나이와 혼인 여부(기혼/미혼)를 입력합니다. 만 30세 미만 미혼자는 무주택기간 0점입니다.' },
          { '@type': 'HowToStep', position: 2, name: '무주택기간 입력', text: '무주택 상태를 유지한 기간(년)을 입력합니다. 1년 미만 2점, 15년 이상 32점(만점)입니다.' },
          { '@type': 'HowToStep', position: 3, name: '부양가족 수 입력', text: '배우자, 미혼 자녀, 직계존속(3년 이상 등재), 미혼 형제자매를 각각 입력합니다.' },
          { '@type': 'HowToStep', position: 4, name: '통장 가입기간 입력', text: '본인 및 배우자의 청약통장 가입기간을 입력합니다. 배우자는 50% 인정, 최대 3점 합산.' },
        ],
      })}} />

      {/* BreadcrumbList */}
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
