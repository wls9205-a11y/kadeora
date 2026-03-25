import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import DiscussClient from './DiscussClient';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 0;

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
    images: [{ url: SITE_URL + '/api/og?title=' + encodeURIComponent('실시간 토론') + '&category=general', width: 1200, height: 630, alt: '카더라 토론' }],
  },
};

export default function DiscussPage() {
  return (
    <Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"홈","item":SITE_URL},{"@type":"ListItem","position":2,"name":"토론","item":SITE_URL + "/discuss"}]}) }} />
      <DiscussClient />
      <Disclaimer />
    </Suspense>
  );
}
