import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import { REPORT_REGIONS, type ReportRegion } from '@/lib/daily-report-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import DailyReportClient from '../DailyReportClient';

interface Props { params: Promise<{ region: string; date: string }> }

export const revalidate = 3600; // 1시간 캐시 (과거 데이터는 변하지 않음)
export const maxDuration = 15;
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: rawR, date: rawD } = await params;
  const region = decodeURIComponent(rawR);
  const dateStr = rawD;
  if (!(REPORT_REGIONS as readonly string[]).includes(region)) return { title: '카더라 데일리 리포트' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { title: '카더라 데일리 리포트' };

  const d = new Date(dateStr);
  const title = `카더라 데일리 리포트 — ${region} 투자 브리핑 (${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일)`;
  const desc = `${dateStr} ${region} 부동산 청약·미분양·재개발 + 국내외 주식 시황 아카이브.`;
  const ogImg = `${SITE_URL}/api/og?title=${encodeURIComponent('카더라 데일리 리포트')}&subtitle=${encodeURIComponent(region + ' ' + dateStr)}&design=2`;
  const canonical = `${SITE_URL}/daily/${encodeURIComponent(region)}/${dateStr}`;

  return {
    title,
    description: desc,
    alternates: { canonical },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title, description: desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'article',
      images: [{ url: ogImg, width: 1200, height: 630, alt: `카더라 데일리 리포트 ${region} ${dateStr}` }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogImg] },
    other: {
      'naver:written_time': new Date(dateStr + 'T07:00:00+09:00').toISOString(),
      'naver:updated_time': new Date(dateStr + 'T07:00:00+09:00').toISOString(),
      'naver:author': '카더라',
      'article:published_time': new Date(dateStr + 'T07:00:00+09:00').toISOString(),
      'article:section': '투자',
      'article:tag': `${region},부동산,주식,투자,카더라데일리,${dateStr}`,
    },
  };
}

export default async function DailyReportDatePage({ params }: Props) {
  const { region: rawR, date: rawD } = await params;
  const region = decodeURIComponent(rawR);
  const dateStr = rawD;

  if (!(REPORT_REGIONS as readonly string[]).includes(region)) return notFound();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return notFound();

  const sb = getSupabaseAdmin();
  const { data: snapshot } = await (sb as any).from('daily_reports')
    .select('data, issue_no')
    .eq('region', region)
    .eq('report_date', dateStr)
    .single();

  if (!snapshot?.data) return notFound();

  // 이전/다음 날짜 확인
  const { data: prevRow } = await (sb as any).from('daily_reports')
    .select('report_date')
    .eq('region', region)
    .lt('report_date', dateStr)
    .order('report_date', { ascending: false })
    .limit(1)
    .single();

  const { data: nextRow } = await (sb as any).from('daily_reports')
    .select('report_date')
    .eq('region', region)
    .gt('report_date', dateStr)
    .order('report_date', { ascending: true })
    .limit(1)
    .single();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: `카더라 데일리 리포트 리포트 — ${region} 투자 브리핑 #${snapshot.issue_no}`,
        datePublished: new Date(dateStr + 'T07:00:00+09:00').toISOString(),
        author: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL },
      }) }} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '데일리', item: `${SITE_URL}/daily/${encodeURIComponent(region)}` },
          { '@type': 'ListItem', position: 3, name: `${dateStr}` },
        ],
      }) }} />

      <DailyReportClient
        data={snapshot.data}
        regions={[...REPORT_REGIONS]}
        viewDate={dateStr}
        prevDate={prevRow?.report_date || null}
        nextDate={nextRow?.report_date || null}
      />
    </div>
  );
}
