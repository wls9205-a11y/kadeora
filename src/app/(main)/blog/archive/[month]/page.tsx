// r4-P5-3 — 월별 블로그 아카이브. /blog/archive/[YYYY-MM]
//
// 30개월 × 월평균 274편. 목록 하나에 다 담을 수 없어 월로 쪼갠다.
//
// 조회수 표기 규칙(실측 기준, 2026-08-22):
//   p90 = 182 이상 -> 숫자 + HOT
//   p75 = 35 이상  -> 숫자만
//   그 미만        -> 표시하지 않는다 (중앙값 18. 낮은 숫자를 찍으면 오히려 신호가 나쁘다)

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isIndexable, INDEX_MIN } from '@/lib/apt/indexable';
import HubHero from '@/components/detail/HubHero';
import PostCard from '@/components/cards/v3/PostCard';

export const revalidate = 3600;
export const dynamicParams = true;
export const maxDuration = 30;

const VIEW_P90 = 182;
const VIEW_P75 = 35;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Props {
  params: Promise<{ month: string }>;
}

interface ArchiveRow {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  published_at: string | null;
  view_count: number | null;
  cover_image: string | null;
  image_alt: string | null;
}

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchMonth(month: string): Promise<ArchiveRow[]> {
  const { start, end } = monthBounds(month);
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any)
    .from('blog_posts')
    .select('slug, title, excerpt, category, published_at, view_count, cover_image, image_alt')
    .eq('is_published', true)
    .not('published_at', 'is', null)
    .gte('published_at', start)
    .lt('published_at', end)
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(300);
  return ((data ?? []) as ArchiveRow[]).filter((r) => r.slug && r.title);
}

/** 발행 이력이 있는 월 목록. 사이트맵과 같은 기준을 쓴다. */
export async function listArchiveMonths(): Promise<string[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('blog_posts')
      .select('published_at')
      .eq('is_published', true)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(20000);
    const counts = new Map<string, number>();
    for (const r of ((data ?? []) as any[])) {
      const m = String(r.published_at).slice(0, 7);
      if (!MONTH_RE.test(m)) continue;
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => isIndexable(n))
      .map(([m]) => m)
      .sort()
      .reverse();
  } catch (err) {
    console.error('[blog/archive months]', err);
    return [];
  }
}

export async function generateStaticParams() {
  const months = await listArchiveMonths();
  return months.slice(0, 36).map((month) => ({ month }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month: raw } = await params;
  const month = decodeURIComponent(raw);
  if (!MONTH_RE.test(month)) return { robots: { index: false, follow: false } };

  const rows = await fetchMonth(month);
  if (!isIndexable(rows.length)) return { robots: { index: false, follow: false } };

  const [y, m] = month.split('-');
  const url = `${SITE_URL}/blog/archive/${month}`;
  const title = `${y}년 ${Number(m)}월 블로그 ${rows.length.toLocaleString()}편 | 카더라`;
  const description = `카더라가 ${y}년 ${Number(m)}월에 발행한 부동산·주식 분석 글 ${rows.length.toLocaleString()}편을 모았습니다.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large' as const,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    },
    openGraph: { title, description, url, siteName: '카더라', locale: 'ko_KR', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function BlogArchiveMonth({ params }: Props) {
  const { month: raw } = await params;
  const month = decodeURIComponent(raw);
  if (!MONTH_RE.test(month)) notFound();

  const rows = await fetchMonth(month);
  if (!isIndexable(rows.length)) notFound();

  const [y, m] = month.split('-');
  const url = `${SITE_URL}/blog/archive/${month}`;
  const months = await listArchiveMonths();
  const idx = months.indexOf(month);
  const newer = idx > 0 ? months[idx - 1] : null;
  const older = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${y}년 ${Number(m)}월 블로그`,
    url,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 30).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/blog/${encodeURIComponent(r.slug)}`,
      name: r.title,
    })),
  };

  return (
    <main style={{ maxWidth: 'var(--container-read)', margin: '0 auto', padding: 'var(--sp-md)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      <nav
        aria-label="breadcrumb"
        style={{
          display: 'flex',
          gap: 6,
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--sp-sm)',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span aria-hidden="true">›</span>
        <Link href="/blog" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>블로그</Link>
        <span aria-hidden="true">›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{y}년 {Number(m)}월</span>
      </nav>

      <HubHero
        eyebrow="ARCHIVE — 월별 모아보기"
        title={`${y}년 ${Number(m)}월 블로그`}
        titleId="archive-title"
        description={`이 달에 발행한 글 ${rows.length.toLocaleString()}편입니다. 조회수 순으로 정렬했습니다.`}
        stats={[{ label: '발행', value: `${rows.length.toLocaleString()}편` }]}
      />

      <section aria-labelledby="archive-list" style={{ marginTop: 'var(--sp-lg)' }}>
        <h2 id="archive-list" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {y}년 {Number(m)}월 발행 글 목록
        </h2>
        <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
          {rows.map((r) => {
            const v = r.view_count ?? 0;
            const caption = [
              r.published_at ? String(r.published_at).slice(0, 10) : '',
              v >= VIEW_P75 ? `조회 ${v.toLocaleString()}` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <PostCard
                key={r.slug}
                href={`/blog/${encodeURIComponent(r.slug)}`}
                title={r.title}
                summary={r.excerpt ?? undefined}
                eyebrow={r.category ?? undefined}
                image={r.cover_image ? { url: r.cover_image, alt: r.image_alt ?? r.title } : null}
                caption={caption || undefined}
                badge={v >= VIEW_P90 ? { label: 'HOT', tone: 'hot' } : null}
              />
            );
          })}
        </div>
      </section>

      <nav
        aria-label="다른 달"
        style={{
          marginTop: 'var(--sp-2xl)',
          paddingTop: 'var(--sp-md)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--sp-sm)',
          fontSize: 'var(--fs-sm)',
        }}
      >
        {older ? (
          <Link href={`/blog/archive/${older}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            ← {older.replace('-', '년 ')}월
          </Link>
        ) : (
          <span />
        )}
        {newer ? (
          <Link href={`/blog/archive/${newer}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            {newer.replace('-', '년 ')}월 →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p style={{ marginTop: 'var(--sp-md)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
        발행 {INDEX_MIN}편 미만인 달은 아카이브 페이지를 만들지 않습니다.
      </p>
    </main>
  );
}
