import type { Metadata } from 'next';
import MapClient from './MapClient';

export const metadata: Metadata = {
  title: '부동산 지도 | 카더라',
  description: '전국 청약·분양·재개발·미분양 정보를 지도에서 한눈에 확인하세요. 지역별 시세, 청약 일정, 미분양 현황까지.',
  alternates: { canonical: 'https://kadeora.app/apt/map' },
};

export default function AptMapPage() {
  return <MapClient />;
}
