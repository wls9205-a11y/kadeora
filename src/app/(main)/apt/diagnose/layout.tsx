import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '청약 가점 진단',
  description: '나의 청약 가점을 계산하고 당첨 가능성을 진단해보세요. 무주택 기간, 부양가족, 청약통장 기간별 점수 자동 계산.',
  alternates: { canonical: SITE_URL + '/apt/diagnose' },
  robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
  openGraph: {
    title: '청약 가점 진단기',
    description: '무주택 기간·부양가족·청약통장 기간별 점수 자동 계산',
    url: SITE_URL + '/apt/diagnose',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('청약 가점 진단')}&subtitle=${encodeURIComponent('당첨 가능성 자동 계산')}`, width: 1200, height: 630, alt: '카더라 청약 가점 진단' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function DiagnoseLayout({ children }: { children: React.ReactNode }) {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: SITE_URL + '/apt' }, { '@type': 'ListItem', position: 3, name: '가점 진단' }] }) }} />{children}</>;
}
