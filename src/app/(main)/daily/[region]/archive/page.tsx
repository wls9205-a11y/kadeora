import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import { REPORT_REGIONS, type ReportRegion } from '@/lib/daily-report-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';

interface Props { params: Promise<{ region: string }> }

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!(REPORT_REGIONS as readonly string[]).includes(region)) return { title: '카더라 데일리' };

  const title = `카더라 데일리 아카이브 — ${region}`;
  const desc = `${region} 투자 브리핑 전체 아카이브. 날짜별로 과거 리포트를 확인하세요.`;
  const canonical = `${SITE_URL}/daily/${encodeURIComponent(region)}/archive`;

  return {
    title, description: desc,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title, description: desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'website' },
  };
}

export default async function ArchivePage({ params }: Props) {
  const { region: raw } = await params;
  const region = decodeURIComponent(raw);
  if (!(REPORT_REGIONS as readonly string[]).includes(region)) return notFound();

  const sb = getSupabaseAdmin();
  const { data: rows } = await (sb as any).from('daily_reports')
    .select('report_date, issue_no')
    .eq('region', region)
    .order('report_date', { ascending: false })
    .limit(365);

  const reports = (rows || []) as { report_date: string; issue_no: number }[];

  // 월별 그룹
  const grouped = new Map<string, typeof reports>();
  reports.forEach(r => {
    const month = r.report_date.slice(0, 7); // "2026-03"
    if (!grouped.has(month)) grouped.set(month, []);
    grouped.get(month)!.push(r);
  });

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '데일리', item: `${SITE_URL}/daily/${encodeURIComponent(region)}` },
          { '@type': 'ListItem', position: 3, name: '아카이브' },
        ],
      }) }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📂 카더라 데일리 아카이브</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{region} · {reports.length}개 리포트</p>
        </div>
        <Link href={`/daily/${encodeURIComponent(region)}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>오늘 보기 →</Link>
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 13 }}>아직 저장된 리포트가 없습니다.</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>매일 오전 7시에 자동 저장됩니다.</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([month, items]) => {
          const [y, m] = month.split('-');
          return (
            <div key={month} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                {y}년 {parseInt(m)}월 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>({items.length}일)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 4 }}>
                {items.map(r => {
                  const d = new Date(r.report_date);
                  return (
                    <Link key={r.report_date} href={`/daily/${encodeURIComponent(region)}/${r.report_date}`} style={{
                      padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      textDecoration: 'none', display: 'block', transition: 'border-color 0.12s',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{d.getDate()}일 ({dayNames[d.getDay()]})</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>#{r.issue_no}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
