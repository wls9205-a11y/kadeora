import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import ShopClient from './ShopClient';
import JsonLd from '@/components/seo/JsonLd';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '확성기',
  description: '카더라 아이템 샵 — 확성기로 내 글을 돋보이게 하세요. 포인트로 구매 가능.',
  alternates: { canonical: SITE_URL + '/shop/megaphone' },
  // ⛔ AD-4(2026-09-07) — 색인에서 내린다. 라우트·화면·상품 로직은 그대로 두는
  //    «가역» 조치다(존폐 2단은 Node 판정). follow: true 인 것이 핵심 —
  //    robots.txt 로 크롤을 막으면 크롤러가 이 noindex 를 «읽지도 못한다»(S8 교훈).
  //    사유: /shop 과 같다 — 폐쇄된 피드용 확성기 판매 표면.
  robots: { index: false, follow: true },
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
  other: { 'dg:plink': SITE_URL + '/shop/megaphone', 'naver:author': '카더라', 'naver:written_time': new Date().toISOString() },
};

export default function ShopPage() {
  return <><JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '아이템 샵' }] }} /><ShopClient /></>;
}
