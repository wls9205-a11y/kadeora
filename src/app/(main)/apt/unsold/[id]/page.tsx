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
  return { title: `${data.house_nm} 미분양 `, description: `${data.region_nm} 미분양 현황` };
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
