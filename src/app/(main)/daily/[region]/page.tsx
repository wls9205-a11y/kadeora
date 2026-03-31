import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import { fetchDailyReportData, REPORT_REGIONS, type ReportRegion } from '@/lib/daily-report-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import DailyReportClient from './DailyReportClient';

interface Props { params: Promise<{ region: string }> }

// ISR on-demand — 첫 요청 시 생성, 60초 캐시
export const revalidate = 60;
export const maxDuration = 30;
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!(REPORT_REGIONS as readonly string[]).includes(region)) return { title: '카더라 데일리 리포트' };

  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[now.getDay()];

  const title = `카더라 데일리 리포트 — ${region} 투자 브리핑 (${dateStr} ${day})`;
  const desc = `${region} 부동산 청약·미분양·재개발 + 국내외 주식 시황을 매일 아침 한 장에 정리. 오늘의 시장 변동과 내일 체크포인트까지.`;
  const ogImg = `${SITE_URL}/api/og?title=${encodeURIComponent('카더라 데일리 리포트')}&subtitle=${encodeURIComponent(region + ' 투자 브리핑')}&design=2`;
  const ogSquare = `${SITE_URL}/api/og-square?title=${encodeURIComponent('카더라 데일리 리포트')}&category=daily`;
  const canonical = `${SITE_URL}/daily/${encodeURIComponent(region)}`;

  return {
    title,
    description: desc,
    alternates: { canonical },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [
        { url: ogImg, width: 1200, height: 630, alt: `카더라 데일리 리포트 ${region}` },
        { url: ogSquare, width: 630, height: 630, alt: `카더라 데일리 리포트 ${region}` },
      ],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogImg] },
    other: {
      'naver:written_time': new Date(now.setHours(7, 0, 0, 0)).toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'naver:author': '카더라',
      'naver:site_name': '카더라',
      'article:published_time': new Date(now.setHours(7, 0, 0, 0)).toISOString(),
      'article:modified_time': new Date().toISOString(),
      'article:author': '카더라',
      'article:section': '투자',
      'article:tag': `${region},부동산,주식,투자,청약,미분양,재개발,시세,카더라데일리`,
      'og:updated_time': new Date().toISOString(),
      'dg:plink': canonical,
    },
  };
}

export default async function DailyReportPage({ params }: Props) {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw) as ReportRegion;
  if (!(REPORT_REGIONS as readonly string[]).includes(region)) notFound();

  const result = await fetchDailyReportData(region as ReportRegion).catch(() => null);
  if (!result) return notFound();
  const data = result;

  // 이전 아카이브 날짜 조회
  const sb = getSupabaseAdmin();
  const todayStr = new Date().toISOString().slice(0, 10);
  const prevResult = await (sb as any).from('daily_reports')
    .select('report_date')
    .eq('region', region)
    .lt('report_date', todayStr)
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevDate = prevResult?.data?.report_date || null;

  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* JSON-LD: NewsArticle */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: `카더라 데일리 리포트 리포트 — ${region} 투자 브리핑 #${data.issueNo}`,
        description: `${region} 부동산 청약·미분양·재개발 + 국내외 주식 시황`,
        url: `${SITE_URL}/daily/${encodeURIComponent(region)}`,
        datePublished: new Date(now.setHours(7, 0, 0, 0)).toISOString(),
        dateModified: new Date().toISOString(),
        author: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png`, width: 192, height: 192 } },
        image: [
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og?title=${encodeURIComponent('카더라 데일리 리포트')}&subtitle=${encodeURIComponent(region)}&design=2`, width: 1200, height: 630 },
          { '@type': 'ImageObject', url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('카더라 데일리 리포트')}&category=daily`, width: 630, height: 630 },
        ],
        thumbnailUrl: `${SITE_URL}/api/og-square?title=${encodeURIComponent('카더라 데일리 리포트')}&category=daily`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/daily/${encodeURIComponent(region)}` },
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.report-summary'] },
        about: [
          { '@type': 'Thing', name: `${region} 부동산` },
          { '@type': 'Thing', name: '주식 시장' },
        ],
      }) }} />

      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '데일리', item: `${SITE_URL}/daily/${encodeURIComponent('서울')}` },
          { '@type': 'ListItem', position: 3, name: `${region} 브리핑` },
        ],
      }) }} />

      {/* JSON-LD: FAQPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `오늘 ${region} 청약 일정은?`,
            acceptedAnswer: { '@type': 'Answer', text: `이번주 ${region} 포함 전국 ${data.subCountThisWeek}건(${data.subUnitsThisWeek.toLocaleString()}세대) 청약이 예정되어 있습니다. 카더라 데일리 리포트에서 매일 업데이트됩니다.` },
          },
          {
            '@type': 'Question',
            name: `${region} 미분양 현황은?`,
            acceptedAnswer: { '@type': 'Answer', text: `${region} 미분양은 ${data.unsoldLocal.reduce((s, r) => s + r.units, 0).toLocaleString()}세대이며, 전국 ${data.unsoldUnits.toLocaleString()}세대 중 ${data.unsoldUnits > 0 ? Math.round(data.unsoldLocal.reduce((s, r) => s + r.units, 0) / data.unsoldUnits * 100) : 0}%입니다.` },
          },
        ],
      }) }} />

      <DailyReportClient data={data} regions={[...REPORT_REGIONS]} prevDate={prevDate} />
    </div>
  );
}
