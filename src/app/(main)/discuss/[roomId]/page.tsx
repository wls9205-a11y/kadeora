import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { DiscussionChat } from '@/components/features/DiscussionChat'
import type { Metadata } from 'next'

interface DiscussRoomPageProps {
  params: Promise<{ roomId: string }>
}

export async function generateMetadata({ params }: DiscussRoomPageProps): Promise<Metadata> {
  const { roomId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('discussion_rooms').select('display_name').eq('id', roomId).single()
  return { title: data?.display_name ?? '토론방' }
}

export default async function DiscussRoomPage({ params }: DiscussRoomPageProps) {
  const { roomId } = await params
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('discussion_rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (!room) notFound()

  // 최근 메시지 50개 불러오기
  const { data: messages } = await supabase
    .from('discussion_messages')
    .select(`
      *,
      profiles:author_id (
        id, nickname, avatar_url, grade, grade_title
      )
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(50)

  // 관련 게시글
  const { data: posts } = await supabase
    .from('posts')
    .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title, is_premium)`)
    .eq('room_id', Number(roomId))
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <DiscussionChat
      room={room}
      initialMessages={((messages ?? []).reverse()) as any}
      relatedPosts={(posts ?? []) as any}
    />
  )
}
