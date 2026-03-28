import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAptSlug } from '@/lib/apt-slug';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('unsold_apts').select('house_nm, region_nm').eq('id', Number(id)).maybeSingle();
  if (!data) return {};
  const title = `${data.house_nm} 미분양`;
  const desc = `${data.region_nm} ${data.house_nm} 미분양 현황 — 세대수, 분양가, 입주 일정을 카더라에서 확인하세요.`;
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: `https://kadeora.app/api/og?title=${encodeURIComponent(data.house_nm)}&category=unsold`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description: desc },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
    },
  };
}

export default async function UnsoldRedirectPage({ params }: Props) {
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('unsold_apts').select('house_nm').eq('id', Number(id)).maybeSingle();
  if (!data?.house_nm) notFound();
  const slug = generateAptSlug(data.house_nm);
  if (slug) permanentRedirect(`/apt/${encodeURIComponent(slug)}`);
  notFound();
}
