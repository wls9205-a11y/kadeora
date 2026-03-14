'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

const REGION_LIST = [
  { id: 'seoul', label: '서울' }, { id: 'busan', label: '부산' },
  { id: 'daegu', label: '대구' }, { id: 'incheon', label: '인천' },
  { id: 'gwangju', label: '광주' }, { id: 'daejeon', label: '대전' },
  { id: 'ulsan', label: '울산' }, { id: 'sejong', label: '세종' },
  { id: 'gyeonggi', label: '경기' }, { id: 'gangwon', label: '강원' },
  { id: 'chungbuk', label: '충북' }, { id: 'chungnam', label: '충남' },
  { id: 'jeonbuk', label: '전북' }, { id: 'jeonnam', label: '전남' },
  { id: 'gyeongbuk', label: '경북' }, { id: 'gyeongnam', label: '경남' },
  { id: 'jeju', label: '제주' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1) // 1: 닉네임, 2: 지역
  const [nickname, setNickname] = useState('')
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { setProfile } = useAuthStore()
  const supabase = createClient()

  // 닉네임 중복 체크 (디바운스)
  async function checkNickname(value: string) {
    if (value.length < 2) { setNicknameStatus('idle'); return }

    setNicknameStatus('checking')
    const { data } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('nickname', value)
      .maybeSingle()

    setNicknameStatus(data ? 'taken' : 'available')
  }

  async function handleComplete() {
    if (!nickname || nicknameStatus !== 'available' || !selectedRegion) return

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')

      const { data, error } = await supabase
        .from('profiles')
        .update({
          nickname,
          nickname_set: true,
          onboarded: true,
          region_text: selectedRegion,
          profile_completed: true,
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      // 관심 지역 등록
      await supabase.from('user_regions').upsert({
        user_id: user.id,
        region_id: selectedRegion,
      })

      setProfile(data)
      toast.success('환영합니다! 🎉')
      router.push('/')
    } catch (e) {
      toast.error('저장 실패. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col px-6 pt-16 pb-8 bg-[#0F0F0F]">
      {/* 헤더 */}
      <div className="mb-10">
        <p className="text-white/40 text-sm mb-1">Step {step} / 2</p>
        <div className="flex gap-1 mb-6">
          <div className="h-1 flex-1 rounded-full bg-brand" />
          <div className={cn('h-1 flex-1 rounded-full transition-colors', step >= 2 ? 'bg-brand' : 'bg-white/10')} />
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">닉네임을 정해주세요</h1>
            <p className="text-white/40 text-sm">한번 설정하면 변경이 어려워요</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">관심 지역을 선택하세요</h1>
            <p className="text-white/40 text-sm">내 지역 이야기를 우선 보여드려요</p>
          </>
        )}
      </div>

      {/* Step 1: 닉네임 */}
      {step === 1 && (
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                const v = e.target.value.replace(/[^가-힣a-zA-Z0-9_]/g, '').slice(0, 12)
                setNickname(v)
                checkNickname(v)
              }}
              placeholder="2~12자, 한글/영문/숫자"
              className="input-base pr-10 text-lg"
              maxLength={12}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {nicknameStatus === 'checking' && <Loader size={16} className="text-white/30 animate-spin" />}
              {nicknameStatus === 'available' && <CheckCircle size={16} className="text-green-400" />}
              {nicknameStatus === 'taken' && <AlertCircle size={16} className="text-red-400" />}
            </div>
          </div>

          {nicknameStatus === 'taken' && (
            <p className="mt-2 text-sm text-red-400">이미 사용 중인 닉네임이에요</p>
          )}
          {nicknameStatus === 'available' && (
            <p className="mt-2 text-sm text-green-400">사용 가능한 닉네임이에요</p>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={nicknameStatus !== 'available'}
            className="btn-brand w-full mt-8 h-14 text-base"
          >
            다음
          </button>
        </div>
      )}

      {/* Step 2: 지역 선택 */}
      {step === 2 && (
        <div className="flex-1">
          <div className="grid grid-cols-4 gap-2">
            {REGION_LIST.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedRegion(id)}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-medium transition-all',
                  selectedRegion === id
                    ? 'bg-brand text-white'
                    : 'bg-[#1A1A1A] text-white/60 hover:bg-[#252525]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-8">
            <button onClick={() => setStep(1)} className="btn-outline h-14 flex-1">
              이전
            </button>
            <button
              onClick={handleComplete}
              disabled={!selectedRegion || saving}
              className="btn-brand h-14 flex-[2] flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
              ) : '카더라 시작하기 🎉'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
