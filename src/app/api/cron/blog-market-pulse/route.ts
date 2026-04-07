export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { SITE_URL } from '@/lib/constants';
import { withCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

function fmt(n: number | null | undefined): string {
  if (n == null) return '-';
  return Number(n).toLocaleString('ko-KR');
}
function pct(n: number | null | undefined): string {
  if (n == null) return '-';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const weekNum = Math.ceil((now.getDate()) / 7);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const slug = `market-pulse-${year}-w${String(now.getDate()).padStart(2, '0')}${String(month).padStart(2, '0')}`;
  const dateLabel = `${year}년 ${month}월 ${now.getDate()}일`;

  // Check duplicate
  const { data: existing } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, created: 0, reason: 'duplicate' });

  // 1. Index data
  const { data: indices } = await (admin as any).from('stock_quotes')
    .select('symbol, name, price, change_pct, market, sector')
    .in('symbol', ['KOSPI_IDX', 'KOSDAQ_IDX'])
    .limit(2);

  // 2. Top gainers/losers (KR only)
  const { data: gainers } = await (admin as any).from('stock_quotes')
    .select('symbol, name, price, change_pct, sector, market')
    .in('market', ['KOSPI', 'KOSDAQ'])
    .not('sector', 'eq', '지수')
    .not('sector', 'eq', 'ETF')
    .order('change_pct', { ascending: false })
    .limit(5);

  const { data: losers } = await (admin as any).from('stock_quotes')
    .select('symbol, name, price, change_pct, sector, market')
    .in('market', ['KOSPI', 'KOSDAQ'])
    .not('sector', 'eq', '지수')
    .not('sector', 'eq', 'ETF')
    .order('change_pct', { ascending: true })
    .limit(5);

  // 3. Exchange rate
  const { data: fx } = await (admin as any).from('exchange_rates')
    .select('currency, rate, change_pct')
    .in('currency', ['USD', 'JPY', 'EUR'])
    .limit(3);

  // 4. Unsold count
  const { count: unsoldCount } = await (admin as any).from('unsold_apts')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  // Build content
  const parts: string[] = [];
  const title = `${dateLabel} 시장 브리핑 — 코스피·코스닥 시황과 환율 동향`;

  parts.push(`# ${title}`);
  parts.push('');
  parts.push(`${dateLabel} 기준 국내 주식시장과 환율, 부동산 핵심 지표를 종합 정리합니다.`);
  parts.push('');

  // Index table
  parts.push('## 주요 지수');
  parts.push('');
  parts.push('| 지수 | 현재가 | 등락률 |');
  parts.push('|---|---|---|');
  (indices ?? []).forEach((idx: any) => {
    parts.push(`| ${idx.name} | ${fmt(idx.price)} | ${pct(idx.change_pct)} |`);
  });
  parts.push('');

  // Exchange
  if (fx?.length) {
    parts.push('## 환율');
    parts.push('');
    parts.push('| 통화 | 환율 | 등락 |');
    parts.push('|---|---|---|');
    (fx ?? []).forEach((r: any) => {
      const label = r.currency === 'USD' ? '원/달러' : r.currency === 'JPY' ? '원/100엔' : '원/유로';
      parts.push(`| ${label} | ${fmt(r.rate)}원 | ${pct(r.change_pct)} |`);
    });
    parts.push('');
  }

  // Gainers
  if (gainers?.length) {
    parts.push('## 급등 종목 TOP 5');
    parts.push('');
    parts.push('| 종목 | 현재가 | 등락률 | 섹터 |');
    parts.push('|---|---|---|---|');
    gainers.forEach((s: any) => {
      parts.push(`| [${s.name}](/stock/${s.symbol}) | ${fmt(s.price)}원 | ${pct(s.change_pct)} | ${s.sector || '-'} |`);
    });
    parts.push('');
  }

  // Losers
  if (losers?.length) {
    parts.push('## 급락 종목 TOP 5');
    parts.push('');
    parts.push('| 종목 | 현재가 | 등락률 | 섹터 |');
    parts.push('|---|---|---|---|');
    losers.forEach((s: any) => {
      parts.push(`| [${s.name}](/stock/${s.symbol}) | ${fmt(s.price)}원 | ${pct(s.change_pct)} | ${s.sector || '-'} |`);
    });
    parts.push('');
  }

  // Real estate one-liner
  parts.push('## 부동산 한 줄');
  parts.push('');
  parts.push(`전국 미분양 아파트: **${fmt(unsoldCount)}개 지역** 집계 중. [미분양 현황 보기](/apt)`);
  parts.push('');

  // CTA
  parts.push('---');
  parts.push('');
  parts.push('카더라에서 더 자세한 종목 분석과 청약 정보를 확인하세요.');
  parts.push('');
  parts.push('- [전 종목 시세 보기](/stock)');
  parts.push('- [청약 일정 확인](/apt)');
  parts.push('- [실시간 토론 참여](/discussion)');

  const content = parts.join('\n');
  if (content.length < 1500) {
    return NextResponse.json({ ok: true, created: 0, reason: 'content_too_short' });
  }

  const tags = ['시장브리핑', '코스피', '코스닥', '환율', '주식시황'];
  const result = await safeBlogInsert(admin, {
    slug, title, content,
    excerpt: `${dateLabel} 코스피·코스닥 시황, 급등락 종목, 환율 동향을 한눈에 정리합니다.`,
    category: 'stock', 
    tags,
    cron_type: 'market-pulse',
    data_date: now.toISOString().slice(0, 10),
    cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&design=2&type=blog`,
    image_alt: generateImageAlt('stock', title),
    meta_description: generateMetaDesc(content),
    meta_keywords: generateMetaKeywords('stock', tags),
  });

  return NextResponse.json({ ok: true, created: result.success ? 1 : 0 });
});
