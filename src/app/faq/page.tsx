import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import FaqClient from './FaqClient';

export const metadata: Metadata = {
  title: '자주 묻는 질문 (FAQ)',
  description: '카더라 서비스 이용에 관한 자주 묻는 질문과 답변입니다. 회원가입, 등급 시스템, 개인정보 보호, 유료 기능 등을 안내합니다.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: '자주 묻는 질문',
    description: '카더라 서비스 이용 FAQ — 회원가입, 등급, 개인정보 보호 안내',
    url: `${SITE_URL}/faq`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('자주 묻는 질문')}&design=2&category=blog`, width: 1200, height: 630, alt: '카더라 FAQ' }],
  },
  twitter: { card: 'summary_large_image', title: '자주 묻는 질문', description: '카더라 서비스 이용 FAQ' },
  other: {
    'naver:written_time': '2026-04-12T00:00:00Z',
    'naver:updated_time': '2026-04-12T00:00:00Z',
    'naver:author': '카더라',
    'og:updated_time': '2026-04-12T00:00:00Z',
    'dg:plink': `${SITE_URL}/faq`,
    'article:section': '안내',
  },
};

// FAQ JSON-LD is in faq/layout.tsx
export default function FAQPage() {
  return <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: '' },
          { '@type': 'ListItem', position: 2, name: '자주 묻는 질문' },
        ],
      })}} />
      <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>카더라 자주 묻는 질문</h1>
      <FaqClient />
    </>;
}
