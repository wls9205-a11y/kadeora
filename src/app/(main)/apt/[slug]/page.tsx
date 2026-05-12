// app/apt/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { generateAptSubMeta, type AptSitePageData } from '@/lib/apt-subscription-meta';
import { AptSubscriptionStructuredData } from '@/components/apt/AptSubscriptionStructuredData';
import { AptSitePageView } from '@/components/apt/AptSitePageView';

export const revalidate = 300;
export const maxDuration = 10;
export const dynamic = 'force-static';
export const dynamicParams = true;

interface Props { params: Promise<{ slug: string }> }

async function fetchAptSite(slugRaw: string): Promise<AptSitePageData | null> {
  const slug = decodeURIComponent(slugRaw);
  const sb = await createSupabaseServer();
  const { data, error } = await sb.rpc('get_apt_site_page' as any, { p_slug: slug });
  if (error || !data) return null;
  return data as AptSitePageData;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const data = await fetchAptSite(slug);
  if (!data?.site) return { title: '단지를 찾을 수 없습니다 | 카더라' };
  return generateAptSubMeta(data.site, data.subscription);
}

export default async function AptSitePage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchAptSite(slug);
  if (!data?.site) notFound();
  return (
    <>
      <AptSubscriptionStructuredData s={data.site} sub={data.subscription} />
      <AptSitePageView data={data} />
    </>
  );
}
