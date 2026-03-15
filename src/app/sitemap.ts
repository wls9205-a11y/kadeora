import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/feed`, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE_URL}/stock`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/apt`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/discuss`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/shop/megaphone`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ];
  let postPages: MetadataRoute.Sitemap = [];
  try {
    const { data: posts } = await supabase.from('posts').select('id, updated_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(500);
    if (posts) { postPages = posts.map((post) => ({ url: `${SITE_URL}/feed/${post.id}`, lastModified: post.updated_at ? new Date(post.updated_at) : new Date(), changeFrequency: 'daily' as const, priority: 0.8 })); }
  } catch (err) { console.error('[sitemap] posts error:', err); }
  let profilePages: MetadataRoute.Sitemap = [];
  try {
    const { data: profiles } = await supabase.from('profiles').select('id').eq('is_deleted', false).limit(200);
    if (profiles) { profilePages = profiles.map((p) => ({ url: `${SITE_URL}/profile/${p.id}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 })); }
  } catch (err) { console.error('[sitemap] profiles error:', err); }
  return [...staticPages, ...postPages, ...profilePages];
}
