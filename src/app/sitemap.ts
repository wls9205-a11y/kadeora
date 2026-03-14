import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.com'
  const supabase = await createClient()

  // 게시글 슬러그 목록
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, id, updated_at')
    .eq('is_deleted', false)
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1000)

  const postUrls: MetadataRoute.Sitemap = (posts ?? []).map(post => ({
    url: `${baseUrl}/post/${post.slug ?? post.id}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // 토론방 목록
  const { data: rooms } = await supabase
    .from('discussion_rooms')
    .select('id, updated_at:created_at')
    .eq('is_active', true)

  const roomUrls: MetadataRoute.Sitemap = (rooms ?? []).map(room => ({
    url: `${baseUrl}/discuss/${room.id}`,
    lastModified: new Date(room.updated_at),
    changeFrequency: 'hourly',
    priority: 0.6,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1,
    },
    {
      url: `${baseUrl}/stocks`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/housing`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/discuss`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    ...postUrls,
    ...roomUrls,
  ]
}
