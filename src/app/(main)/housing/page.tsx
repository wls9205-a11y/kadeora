import { createClient } from '@/lib/supabase/server'
import { HousingList } from '@/components/features/HousingList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '청약' }

interface HousingPageProps {
  searchParams: Promise<{ region?: string; q?: string }>
}

export default async function HousingPage({ searchParams }: HousingPageProps) {
  const params = await searchParams
  const region = params.region ?? ''
  const query = params.q ?? ''
  const supabase = await createClient()

  // 청약 일정
  let scheduleQuery = supabase
    .from('subscription_schedules')
    .select('*')
    .gte('apply_end', new Date().toISOString().split('T')[0]) // 마감 안된 것
    .order('apply_start', { ascending: true })
    .limit(30)

  if (region) scheduleQuery = scheduleQuery.ilike('location', `%${region}%`)
  if (query) scheduleQuery = scheduleQuery.ilike('apt_name', `%${query}%`)

  const { data: schedules } = await scheduleQuery

  // apt_subscriptions (공공데이터)
  let aptQuery = supabase
    .from('apt_subscriptions')
    .select('*')
    .order('rcept_bgnde', { ascending: false })
    .limit(20)

  if (region) aptQuery = aptQuery.ilike('region_nm', `%${region}%`)

  const { data: apts } = await aptQuery

  // 청약 관련 게시글
  const { data: posts } = await supabase
    .from('posts')
    .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title, is_premium)`)
    .eq('category', 'housing')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen">
      <HousingList
        schedules={schedules ?? []}
        apts={apts ?? []}
        posts={(posts ?? []) as any}
        currentRegion={region}
        query={query}
      />
    </div>
  )
}
