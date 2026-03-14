'use client'
export const dynamic = 'force-dynamic'


import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ChevronLeft, Camera, Check, AlertCircle, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const INTERESTS = [
  '주식', '부동산', '청약', '코인', '경제', '재테크',
  '부업', '창업', '취업', '육아', '맛집', '여행',
]

export default function ProfileEditPage() {
  const { profile, setProfile, user } = useAuthStore()
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests ?? [])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'same'>('same')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const timer = useRef<ReturnType<typeof setTimeout>>()

  if (!profile || !user) { router.push('/login'); return null }

  const canChangeNickname = (profile.nickname_change_tickets ?? 0) > 0 || !profile.nickname_set

  async function checkNickname(value: string) {
    if (value === profile?.nickname) { setNicknameStatus('same'); return }
    if (value.length < 2) { setNicknameStatus('idle'); return }
    setNicknameStatus('checking')
    const { data } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('nickname', value)
      .maybeSingle()
    setNicknameStatus(data ? 'taken' : 'available')
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하 이미지만 가능해요'); return }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true })
      if (error) throw error

      const { data } = supabase.storage.from('images').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      toast.success('프로필 사진 업로드됨')
    } catch {
      toast.error('업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  function toggleInterest(item: string) {
    setSelectedInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item].slice(0, 6)
    )
  }

  async function handleSave() {
    if (nicknameStatus === 'taken') return
    if (nickname.length < 2) { toast.error('닉네임은 2자 이상이에요'); return }

    setSaving(true)
    try {
      const updates: Record<string, unknown> = {
        bio,
        interests: selectedInterests,
        updated_at: new Date().toISOString(),
      }

      if (avatarUrl !== profile.avatar_url) updates.avatar_url = avatarUrl

      // 닉네임 변경
      if (nickname !== profile.nickname && nicknameStatus === 'available') {
        if (!canChangeNickname) { toast.error('닉네임 변경권이 없어요'); setSaving(false); return }
        updates.nickname = nickname
        updates.nickname_set = true
        updates.nickname_change_count = (profile.nickname_change_count ?? 0) + 1
        if (profile.nickname_set) {
          updates.nickname_change_tickets = (profile.nickname_change_tickets ?? 0) - 1
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      toast.success('저장됐어요!')
      router.back()
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh max-w-mobile mx-auto bg-[#0F0F0F]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] sticky top-0 bg-[#0F0F0F]/95 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={20} className="text-white/70" />
        </button>
        <span className="flex-1 text-base font-semibold text-white">프로필 편집</span>
        <button
          onClick={handleSave}
          disabled={saving || nicknameStatus === 'taken'}
          className="btn-brand py-1.5 px-4 text-sm"
        >
          {saving ? <Loader size={14} className="animate-spin" /> : '저장'}
        </button>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* 아바타 */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {avatarUrl ? (
              <Image src={avatarUrl} alt="프로필" width={88} height={88} className="rounded-2xl object-cover w-[88px] h-[88px]" />
            ) : (
              <div className="w-[88px] h-[88px] rounded-2xl bg-brand/20 flex items-center justify-center text-3xl font-black text-brand">
                {nickname[0] ?? '?'}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-lg"
            >
              {uploading ? <Loader size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
            </button>
          </div>
          <p className="text-xs text-white/30">프로필 사진 변경 (5MB 이하)</p>
        </div>

        {/* 닉네임 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-white/70">닉네임</label>
            {profile.nickname_set && (
              <span className="text-[11px] text-white/30">
                변경권 {profile.nickname_change_tickets ?? 0}개 보유
              </span>
            )}
          </div>
          <div className="relative">
            <input
              value={nickname}
              onChange={e => {
                const v = e.target.value.replace(/[^가-힣a-zA-Z0-9_]/g, '').slice(0, 12)
                setNickname(v)
                clearTimeout(timer.current)
                timer.current = setTimeout(() => checkNickname(v), 400)
              }}
              disabled={!canChangeNickname}
              placeholder="2~12자"
              className={cn('input-base pr-10', !canChangeNickname && 'opacity-50 cursor-not-allowed')}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {nicknameStatus === 'checking' && <Loader size={15} className="text-white/30 animate-spin" />}
              {nicknameStatus === 'available' && <Check size={15} className="text-green-400" />}
              {nicknameStatus === 'taken' && <AlertCircle size={15} className="text-red-400" />}
            </div>
          </div>
          {!canChangeNickname && (
            <p className="mt-1.5 text-[12px] text-white/30">닉네임 변경권이 필요해요 (상점에서 구매)</p>
          )}
          {nicknameStatus === 'taken' && <p className="mt-1.5 text-[12px] text-red-400">이미 사용 중인 닉네임이에요</p>}
        </div>

        {/* 자기소개 */}
        <div>
          <label className="text-sm font-semibold text-white/70 block mb-2">자기소개</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 150))}
            placeholder="간단한 자기소개를 써주세요"
            rows={3}
            className="input-base resize-none text-sm"
          />
          <p className="text-right text-[11px] text-white/25 mt-1">{bio.length}/150</p>
        </div>

        {/* 관심사 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-white/70">관심사</label>
            <span className="text-[11px] text-white/30">최대 6개</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(item => (
              <button
                key={item}
                onClick={() => toggleInterest(item)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                  selectedInterests.includes(item)
                    ? 'bg-brand/20 text-brand border border-brand/30'
                    : 'bg-white/[0.06] text-white/50 hover:bg-white/10'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* 거주 지역 (읽기 전용 — 온보딩에서 설정) */}
        <div>
          <label className="text-sm font-semibold text-white/70 block mb-2">관심 지역</label>
          <div className="input-base text-sm text-white/50 flex items-center justify-between">
            <span>{profile.region_text ?? '미설정'}</span>
            <span className="text-[11px] text-white/25">변경 불가</span>
          </div>
        </div>
      </div>
    </div>
  )
}
