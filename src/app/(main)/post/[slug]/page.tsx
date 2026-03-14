import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PostDetail } from '@/components/features/PostDetail'
import { CommentSection } from '@/components/features/CommentSection'
import type { Metadata } from 'next'

interface PostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const id = slug.split('-').pop()
  const { data: post } = await supabase
    .from('posts')
    .select('title, content, profiles:author_id(nickname)')
    .or(`slug.eq.${slug},id.eq.${id}`)
    .eq('is_deleted', false)
    .single()

  if (!post) return { title: '게시글을 찾을 수 없음' }

  const author = (post.profiles as { nickname: string } | null)?.nickname
  const description = post.content.slice(0, 120)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.com'
  const ogUrl = `${siteUrl}/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(author ?? '')}`

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogUrl],
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const id = slug.split('-').pop()

  const { data: post } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:author_id (
        id, nickname, avatar_url, grade, grade_title, is_premium, influence_score, bio
      )
    `)
    .or(`slug.eq.${slug},id.eq.${id}`)
    .eq('is_deleted', false)
    .single()

  if (!post) notFound()

  // 조회수 증가 (fire & forget)
  supabase
    .from('posts')
    .update({ view_count: (post.view_count ?? 0) + 1 })
    .eq('id', post.id)
    .then(() => {})

  // 댓글 조회
  const { data: comments } = await supabase
    .from('comments')
    .select(`
      *,
      profiles:author_id (
        id, nickname, avatar_url, grade, grade_title, is_premium
      )
    `)
    .eq('post_id', post.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  // 고정 게시글 여부
  const { data: pinned } = await supabase
    .from('pinned_posts')
    .select('id')
    .eq('post_id', post.id)
    .eq('is_active', true)
    .maybeSingle()

  return (
    <div className="min-h-screen">
      <PostDetail post={post as any} isPinned={!!pinned} />
      <CommentSection postId={post.id} initialComments={(comments ?? []) as any} />
    </div>
  )
}
