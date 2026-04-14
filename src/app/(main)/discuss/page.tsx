import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import DiscussClient from './DiscussClient';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '토론',
  description: '주식, 부동산, 경제 이슈 — 지금 뜨거운 토론과 실시간 라운지. A vs B 투표로 의견을 나누세요.',
  alternates: { canonical: SITE_URL + '/discuss' },
  openGraph: {
    title: '카더라 토론',
    description: '주식·부동산·경제 실시간 토론과 투표',
    url: SITE_URL + '/discuss',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('실시간 토론')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 토론' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('실시간 토론')}&category=general`, width: 630, height: 630, alt: '카더라 토론' },
    ],
  },
  twitter: { card: 'summary_large_image', title: '카더라 토론', description: '주식·부동산·경제 실시간 토론과 투표' },
  other: { 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'article:section': '토론', 'article:tag': '토론,투표,주식,부동산,커뮤니티,실시간', 'dg:plink': SITE_URL + '/discuss', 'naver:author': '카더라', 'og:updated_time': new Date().toISOString() },
};

export default function DiscussPage() {
  return (
    <Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"홈","item":SITE_URL},{"@type":"ListItem","position":2,"name":"토론","item":SITE_URL + "/discuss"}]}) }} />
      <h1 style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)" }}>카더라 토론 — 주식·부동산·경제 실시간 토론</h1>
      <DiscussClient />
      <Disclaimer type="general" />
    </Suspense>
  );
}
