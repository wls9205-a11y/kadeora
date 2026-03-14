import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileView } from '@/components/features/ProfileView'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '내 정보' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  // 내 게시글
  const { data: posts } = await supabase
    .from('posts')
    .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title, is_premium)`)
    .eq('author_id', user.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)

  // 출석 정보
  const { data: attendance } = await supabase
    .from('attendance')
    .select('streak, total_days, last_date')
    .eq('user_id', user.id)
    .single()

  // 등급 정의
  const { data: grades } = await supabase
    .from('grade_definitions')
    .select('*')
    .order('grade', { ascending: true })

  return (
    <ProfileView
      profile={profile}
      posts={(posts ?? []) as any}
      attendance={attendance}
      grades={grades ?? []}
      isOwner
    />
  )
}
