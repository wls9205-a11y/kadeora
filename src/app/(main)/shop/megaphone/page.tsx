import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import ShopClient from './ShopClient';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '확성기',
  description: '카더라 아이템 샵 — 확성기로 내 글을 돋보이게 하세요. 포인트로 구매 가능.',
  alternates: { canonical: SITE_URL + '/shop/megaphone' },
  other: { 'naver:author': '카더라', 'naver:written_time': new Date().toISOString() },
  openGraph: {
    title: '확성기 아이템 샵',
    description: '포인트로 확성기를 구매하여 내 글을 돋보이게',
    url: SITE_URL + '/shop/megaphone',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('확성기 아이템')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 확성기' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('확성기')}&category=general`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'dg:plink': SITE_URL + '/shop/megaphone' },
};

export default function ShopPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '아이템 샵' }] }) }} /><ShopClient /></>;
}
