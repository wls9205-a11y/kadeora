import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import DiscussClient from './DiscussClient';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 0;

export const metadata: Metadata = {
  title: '토론',
  description: '지금 뜨거운 토론과 실시간 라운지',
  alternates: { canonical: 'https://kadeora.app/discuss' },
  openGraph: {
    title: '토론',
    description: '실시간 라운지와 뜨거운 토론',
    images: [{ url: SITE_URL + '/images/brand/kadeora-hero.png', alt: '카더라 토론' }],
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
