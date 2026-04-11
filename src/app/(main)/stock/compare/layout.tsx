import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: '주식 종목 비교 — 국내외 핵심 지표 한눈에',
  description: '코스피, 코스닥, NYSE, NASDAQ 종목의 시가총액, PER, PBR, 배당수익률 등 핵심 지표를 한눈에 비교하세요.',
  path: '/stock/compare',
  section: '주식',
  ogCategory: 'stock',
  keywords: '주식 비교, 종목 비교, PER 비교, 시가총액 비교, 코스피, 코스닥, 카더라',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
