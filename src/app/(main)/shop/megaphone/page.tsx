'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Megaphone, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

const TIER_CONFIG = {
  megaphone_basic: { tier: 'basic' as const, label: '일반', duration: '30분', color: '#00ff88', bg: '#000000' },
  megaphone_standard: { tier: 'standard' as const, label: '스탠다드', duration: '30분', color: '#FFD700', bg: '#1A1A00' },
  megaphone_urgent: { tier: 'urgent' as const, label: '긴급', duration: '30분', color: '#FF4B36', bg: '#1A0000' },
}

function MegaphoneContent() {
  const [message, setMessage] = useState('')
  const [textColor, setTextColor] = useState('#00ff88')
  const [bgColor, setBgColor] = useState('#000000')
  const [sending, setSending] = useState(false)
  const [purchase, setPurchase] = useState<{ id: number; product_id: string } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const purchaseId = searchParams.get('purchase')
  const { user, profile } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    if (!purchaseId || !user) return
    supabase
      .from('purchases')
      .select('id, product_id')
      .eq('id', purchaseId)
      .eq('user_id', user.id)
      .eq('used', false)
      .single()
      .then(({ data }) => {
        if (data) {
          setPurchase(data)
          const cfg = TIER_CONFIG[data.product_id as keyof typeof TIER_CONFIG]
          if (cfg) { setTextColor(cfg.color); setBgColor(cfg.bg) }
        } else {
          toast.error('유효하지 않은 구매입니다')
          router.push('/shop')
        }
      })
  }, [purchaseId, user])

  const tier = purchase ? TIER_CONFIG[purchase.product_id as keyof typeof TIER_CONFIG] : null

  async function handleSend() {
    if (!user || !purchase || !profile || !tier) return
    if (!message.trim()) { toast.error('메시지를 입력해주세요'); return }
    setSending(true)
    try {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 30 * 60 * 1000)
      const { error } = await supabase.from('megaphones').insert({
        user_id: user.id,
        purchase_id: purchase.id,
        message: message.trim(),
        nickname: profile.nickname,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        tier: tier.tier,
        text_color: textColor,
        bg_color: bgColor,
        is_active: true,
        queue_status: 'active',
      })
      if (error) throw error
      await supabase.from('purchases').update({ used: true, used_at: new Date().toISOString() }).eq('id', purchase.id)
      toast.success('확성기 메시지 등록 완료! 📢')
      router.push('/')
    } catch {
      toast.error('등록 실패')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-dvh max-w-mobile mx-auto bg-[#0F0F0F]">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] sticky top-0 bg-[#0F0F0F]/95 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={20} className="text-white/70" />
        </button>
        <span className="flex-1 text-base font-semibold text-white">확성기 메시지</span>
      </div>
      <div className="px-4 py-6 space-y-6">
        {tier && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Megaphone size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{tier.label} 확성기</p>
              <p className="text-xs text-white/40">{tier.duration} 동안 배너에 노출</p>
            </div>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-white/70 mb-2">미리보기</p>
          <div className="h-8 overflow-hidden flex items-center rounded-xl px-3 gap-2" style={{ backgroundColor: bgColor }}>
            <span className="text-sm flex-shrink-0">{tier?.tier === 'urgent' ? '🚨' : '📢'}</span>
            <p className="text-sm font-medium truncate" style={{ color: textColor }}>
              <span className="opacity-70 mr-1">{profile?.nickname}</span>
              {message || '메시지를 입력하세요...'}
            </p>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-white/70 block mb-2">메시지</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, 200))}
            placeholder="전달할 메시지를 입력하세요 (최대 200자)"
            rows={4}
            className="input-base resize-none text-sm"
          />
          <p className="text-right text-[11px] text-white/25 mt-1">{message.length}/200</p>
        </div>
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending || !purchase}
          className="btn-brand w-full h-14 text-base flex items-center justify-center gap-2"
        >
          {sending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />전송 중...</> : <><Megaphone size={18} />확성기 전송</>}
        </button>
      </div>
    </div>
  )
}

export default function MegaphonePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0F0F0F]" />}>
      <MegaphoneContent />
    </Suspense>
  )
}
