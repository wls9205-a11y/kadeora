import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { fmtPrice } from '@/lib/format';

export const revalidate = 3600;
interface Props { params: Promise<{ symbol: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const sb = await createSupabaseServer();
  const { data: s } = await (sb as any).from('stock_quotes')
    .select('name,market,currency,per,pbr,eps,roe,dividend_yield,market_cap').eq('symbol', symbol).maybeSingle();
  if (!s) return { title: '종목을 찾을 수 없습니다', robots: { index: false } };
  const perStr = Number(s.per) > 0 ? `PER ${Number(s.per).toFixed(1)}배` : '';
  const divStr = Number(s.dividend_yield) > 0 ? `배당수익률 ${Number(s.dividend_yield).toFixed(2)}%` : '';
  return {
    title: `${s.name}(${symbol}) 재무제표·PER·배당금 — ${[perStr, divStr].filter(Boolean).join(' · ') || '카더라'}`,
    description: `${s.name}(${symbol}) 재무 지표. ${[perStr, divStr].filter(Boolean).join(', ')}. PER·PBR·EPS·ROE·배당수익률·시가총액 종합 분석을 카더라에서 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/stock/${symbol}/financials` },
    openGraph: {
      title: `${s.name}(${symbol}) 재무제표 — PER·PBR·배당·EPS`,
      url: `${SITE_URL}/stock/${symbol}/financials`,
    },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'naver:author': '카더라',
      'article:section': '주식',
      'article:tag': `${s.name},${symbol},재무제표,PER,PBR,배당금,EPS,ROE,밸류에이션`,
    },
  };
}

export default async function StockFinancialsPage({ params }: Props) {
  const { symbol } = await params;
  redirect(`/stock/${symbol}`);
}
