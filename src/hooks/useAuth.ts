'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated, setUser, logout: storeLogout } = useAuthStore()

  const refreshProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        setUser(profile)
      }
    }
  }, [setUser])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    storeLogout()
    router.push('/login')
  }, [storeLogout, router])

  const updatePoints = useCallback(async (amount: number, description: string) => {
    if (!user) return false

    const supabase = createClient()
    const newPoints = user.points + amount

    const { error } = await supabase
      .from('profiles')
      .update({ points: newPoints })
      .eq('id', user.id)

    if (!error) {
      await supabase.from('point_transactions').insert({
        user_id: user.id,
        amount,
        type: amount > 0 ? 'earn' : 'spend',
        description,
      })

      await refreshProfile()
      return true
    }

    return false
  }, [user, refreshProfile])

  const checkAttendance = useCallback(async () => {
    if (!user) return null

    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    // 오늘 출석 여부 확인
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .gte('attended_at', today)
      .single()

    if (existing) {
      return { alreadyChecked: true }
    }

    // 출석 체크
    await supabase.from('attendance').insert({ user_id: user.id })

    // 연속 출석 계산
    const consecutive = user.consecutive_attendance + 1
    const isBonus = consecutive % 7 === 0
    const points = 10 + (isBonus ? 30 : 0)

    await supabase
      .from('profiles')
      .update({
        consecutive_attendance: consecutive,
        total_attendance: user.total_attendance + 1,
        points: user.points + points,
      })
      .eq('id', user.id)

    await refreshProfile()

    return { points, isBonus, consecutive }
  }, [user, refreshProfile])

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    refreshProfile,
    updatePoints,
    checkAttendance,
  }
}
