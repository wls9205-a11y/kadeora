import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import MapClient from './MapClient';

export const metadata: Metadata = {
  title: '부동산 지도',
  description: '전국 청약·분양·재개발·미분양 정보를 지도에서 한눈에 확인하세요. 지역별 시세, 청약 일정, 미분양 현황까지.',
  alternates: { canonical: SITE_URL + '/apt/map' },
  openGraph: {
    title: '부동산 지도',
    description: '전국 청약·분양·재개발·미분양 지도 보기',
    url: SITE_URL + '/apt/map',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('부동산 지도')}&subtitle=${encodeURIComponent('전국 청약·분양·미분양 한눈에')}`, width: 1200, height: 630, alt: '카더라 부동산 지도' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': new Date().toISOString(), 'article:section': '부동산' },
};

export default function AptMapPage() {
  return <MapClient />;
}
