import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { fmtPrice } from '@/lib/format';
import Link from 'next/link';

export const revalidate = 300;

interface Props { params: Promise<{ symbol: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await (sb as any).from('stock_quotes')
    .select('name,market,price,currency,change_pct,sector,high_52w,low_52w').eq('symbol', symbol).maybeSingle();
  if (!s) return { title: '종목을 찾을 수 없습니다', robots: { index: false } };
  const p = fmtPrice(Number(s.price), s.currency ?? undefined);
  return {
    title: `${s.name}(${symbol}) 주가 차트 — 일봉·주봉·이동평균선`,
    description: `${s.name}(${symbol}) 주가 차트. 현재가 ${p}. 일봉·주봉 차트, 이동평균선(5/20/60일), 52주 고저, 수급 분석을 카더라에서 무료로 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/stock/${symbol}/chart` },
    openGraph: {
      title: `${s.name}(${symbol}) 주가 차트 — 카더라`,
      description: `${s.name} 현재가 ${p} · 일봉·주봉·이동평균 차트 · 52주 고저`,
      url: `${SITE_URL}/stock/${symbol}/chart`,
      images: [{ url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(s.name + ' ' + symbol)}&category=stock`, width: 630, height: 630 }],
    },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'naver:author': '카더라',
      'article:section': '주식',
      'article:tag': `${s.name},${symbol},주가차트,이동평균선,주봉,일봉,기술적분석`,
    },
  };
}

export default async function StockChartPage({ params }: Props) {
  const { symbol } = await params;
  // 차트 탭으로 리다이렉트 (SEO URL 확보 + UX는 메인 페이지 탭으로)
  redirect(`/stock/${symbol}?tab=chart`);
}
