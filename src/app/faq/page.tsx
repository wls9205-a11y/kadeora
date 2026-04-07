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
    'naver:written_time': new Date().toISOString(),
    'naver:updated_time': new Date().toISOString(),
    'naver:author': '카더라',
    'og:updated_time': new Date().toISOString(),
    'dg:plink': `${SITE_URL}/faq`,
    'article:section': '안내',
  },
};

// FAQ JSON-LD is in faq/layout.tsx
export default function FAQPage() {
  return <FaqClient />;
}
