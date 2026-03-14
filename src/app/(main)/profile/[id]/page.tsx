import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProfileView } from '@/components/features/ProfileView'
import type { Metadata } from 'next'

interface ProfileIdPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProfileIdPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('nickname').eq('id', id).single()
  return { title: data?.nickname ?? '프로필' }
}

export default async function ProfileIdPage({ params }: ProfileIdPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
  if (!profile) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === id

  const { data: posts } = await supabase
    .from('posts')
    .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title, is_premium)`)
    .eq('author_id', id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: grades } = await supabase
    .from('grade_definitions')
    .select('*')
    .order('grade', { ascending: true })

  return (
    <ProfileView
      profile={profile}
      posts={(posts ?? []) as any}
      attendance={null}
      grades={grades ?? []}
      isOwner={isOwner}
    />
  )
}
