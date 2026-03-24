import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import FaqClient from './FaqClient';

export const metadata: Metadata = {
  title: '자주 묻는 질문 (FAQ) | 카더라',
  description: '카더라 서비스 이용에 관한 자주 묻는 질문과 답변입니다. 회원가입, 등급 시스템, 개인정보 보호, 유료 기능 등을 안내합니다.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: '자주 묻는 질문 | 카더라',
    description: '카더라 서비스 이용 FAQ — 회원가입, 등급, 개인정보 보호 안내',
    url: `${SITE_URL}/faq`,
  },
};

export default function FAQPage() {
  return <FaqClient />;
}
