import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: '주식 종목 검색 — 국내외 728종목',
  description: '코스피, 코스닥, NYSE, NASDAQ 728종목을 이름, 코드, 섹터로 검색하세요.',
  path: '/stock/search',
  section: '주식',
  ogCategory: 'stock',
  keywords: '주식 검색, 종목 검색, 코스피, 코스닥, NYSE, NASDAQ, 카더라',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
