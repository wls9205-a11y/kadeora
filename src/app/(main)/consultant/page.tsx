import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import ConsultantRegister from './ConsultantRegister';

const title = '분양 상담사 등록 — 카더라';
const desc = '카더라에서 분양 상담사로 등록하고 프리미엄 리스팅으로 고객을 만나세요. 월 4.9만원부터 전국 청약 단지 노출.';

export const metadata: Metadata = {
  title,
  description: desc,
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/consultant` },
  openGraph: {
    title, description: desc, url: `${SITE_URL}/consultant`, siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('분양 상담사 등록')}&design=2&category=apt`, width: 1200, height: 630 },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('상담사 등록')}&category=apt`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image', title, description: desc },
  other: { 'naver:author': '카더라' },
};

export default function ConsultantPage() {
  return <ConsultantRegister />;
}
