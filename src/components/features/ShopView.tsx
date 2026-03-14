'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Megaphone, Pin, Crown, RefreshCw, ShoppingBag,
  ChevronRight, Check, Clock, Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCount } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { ShopProduct, Purchase } from '@/types/database'

interface ShopViewProps {
  products: ShopProduct[]
  profile: { points: number; is_premium: boolean; premium_expires_at: string | null; nickname_change_tickets: number } | null
  recentPurchases: Purchase[]
  userId: string
}

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  megaphone_basic: Megaphone,
  megaphone_standard: Megaphone,
  megaphone_urgent: Zap,
  pinned_post_24h: Pin,
  premium_30d: Crown,
  premium_90d: Crown,
  nickname_change: RefreshCw,
}

const PRODUCT_COLORS: Record<string, string> = {
  megaphone_basic: 'text-green-400 bg-green-400/10',
  megaphone_standard: 'text-blue-400 bg-blue-400/10',
  megaphone_urgent: 'text-red-400 bg-red-400/10',
  pinned_post_24h: 'text-yellow-400 bg-yellow-400/10',
  premium_30d: 'text-purple-400 bg-purple-400/10',
  premium_90d: 'text-purple-400 bg-purple-400/10',
  nickname_change: 'text-brand bg-brand/10',
}

const PRODUCT_GROUPS = [
  { label: '📢 확성기', ids: ['megaphone_basic', 'megaphone_standard', 'megaphone_urgent'] },
  { label: '📌 게시글 고정', ids: ['pinned_post_24h'] },
  { label: '👑 프리미엄', ids: ['premium_30d', 'premium_90d'] },
  { label: '🔄 닉네임 변경', ids: ['nickname_change'] },
]

export function ShopView({ products, profile, recentPurchases, userId }: ShopViewProps) {
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const points = profile?.points ?? 0

  async function handlePurchase() {
    if (!selectedProduct) return
    if (points < selectedProduct.price_krw) {
      toast.error('포인트가 부족해요')
      return
    }

    setPurchasing(true)
    try {
      // 구매 기록 생성
      const orderId = `order_${Date.now()}_${userId.slice(0, 8)}`
      const { data: purchase, error } = await supabase
        .from('purchases')
        .insert({
          user_id: userId,
          product_id: selectedProduct.id,
          amount_krw: selectedProduct.price_krw,
          order_id: orderId,
          status: 'completed',
          used: false,
        })
        .select()
        .single()

      if (error) throw error

      // 포인트 차감
      await supabase
        .from('profiles')
        .update({ points: points - selectedProduct.price_krw })
        .eq('id', userId)

      // 상품별 즉시 처리
      if (selectedProduct.id.startsWith('premium_')) {
        const days = selectedProduct.id === 'premium_30d' ? 30 : 90
        const expiresAt = new Date(Date.now() + days * 86400000).toISOString()
        await supabase.from('profiles').update({
          is_premium: true,
          premium_expires_at: expiresAt,
        }).eq('id', userId)
      }

      if (selectedProduct.id === 'nickname_change') {
        await supabase.from('profiles').update({
          nickname_change_tickets: (profile?.nickname_change_tickets ?? 0) + 1,
        }).eq('id', userId)
      }

      toast.success(`${selectedProduct.name} 구매 완료! 🎉`)
      setShowConfirm(false)
      setSelectedProduct(null)
      router.refresh()
    } catch {
      toast.error('구매 실패. 다시 시도해주세요.')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className="min-h-screen pb-6">
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <h1 className="text-xl font-bold text-white mb-1">상점</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="card flex items-center gap-2 px-3 py-2 flex-1">
            <span className="text-lg">💎</span>
            <div>
              <p className="text-[11px] text-white/40">보유 포인트</p>
              <p className="text-[16px] font-bold text-white">{formatCount(points)}P</p>
            </div>
          </div>
          {profile?.is_premium && (
            <div className="card flex items-center gap-2 px-3 py-2">
              <Crown size={16} className="text-yellow-400" />
              <div>
                <p className="text-[11px] text-white/40">프리미엄</p>
                <p className="text-[12px] font-medium text-yellow-400">활성</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상품 그룹 */}
      <div className="px-4 py-4 space-y-6">
        {PRODUCT_GROUPS.map(group => {
          const groupProducts = products.filter(p => group.ids.includes(p.id))
          if (groupProducts.length === 0) return null

          return (
            <section key={group.label}>
              <h2 className="text-sm font-semibold text-white/60 mb-3">{group.label}</h2>
              <div className="space-y-2">
                {groupProducts.map(product => {
                  const Icon = PRODUCT_ICONS[product.id] ?? ShoppingBag
                  const colorClass = PRODUCT_COLORS[product.id] ?? 'text-white/60 bg-white/10'
                  const canAfford = points >= product.price_krw

                  return (
                    <button
                      key={product.id}
                      onClick={() => { setSelectedProduct(product); setShowConfirm(true) }}
                      className="w-full card flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorClass)}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white">{product.name}</p>
                        <p className="text-[12px] text-white/40 mt-0.5 truncate">{product.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={cn('text-[14px] font-bold', canAfford ? 'text-white' : 'text-white/30')}>
                          {product.price_krw.toLocaleString()}P
                        </p>
                        <ChevronRight size={14} className="text-white/20 ml-auto mt-0.5" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* 포인트 충전 안내 */}
        <section>
          <h2 className="text-sm font-semibold text-white/60 mb-3">💰 포인트 얻는 법</h2>
          <div className="card p-4 space-y-2.5">
            {[
              { label: '매일 출석 체크', point: '+10P' },
              { label: '연속 출석 보너스 (7일)', point: '+30P' },
              { label: '게시글 좋아요 받기', point: '+1P' },
              { label: '프로필 완성', point: '+50P' },
              { label: 'SNS 공유하기', point: '+5P' },
            ].map(({ label, point }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-white/60">{label}</span>
                <span className="text-[13px] font-semibold text-green-400">{point}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 최근 구매 내역 */}
        {recentPurchases.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-white/60 mb-3">🧾 최근 구매</h2>
            <div className="space-y-2">
              {recentPurchases.map(p => (
                <div key={p.id} className="card flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white/70 truncate">{p.product_id}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {new Date(p.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[13px] font-medium text-white/50">
                      -{p.amount_krw.toLocaleString()}P
                    </span>
                    <span className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full',
                      p.status === 'completed' ? 'bg-green-400/10 text-green-400' : 'bg-white/10 text-white/40'
                    )}>
                      {p.status === 'completed' ? '완료' : p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 구매 확인 바텀시트 */}
      {showConfirm && selectedProduct && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => { setShowConfirm(false); setSelectedProduct(null) }}
          />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile z-50
                          bg-[#1A1A1A] rounded-t-2xl border-t border-white/[0.08] p-6
                          animate-slide-up"
               style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />

            <h3 className="text-lg font-bold text-white mb-1">{selectedProduct.name}</h3>
            <p className="text-sm text-white/50 mb-5">{selectedProduct.description}</p>

            <div className="card p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">상품 금액</span>
                <span className="text-white font-semibold">{selectedProduct.price_krw.toLocaleString()}P</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">보유 포인트</span>
                <span className={cn('font-semibold', points >= selectedProduct.price_krw ? 'text-white' : 'text-red-400')}>
                  {formatCount(points)}P
                </span>
              </div>
              <div className="divider" />
              <div className="flex justify-between text-sm">
                <span className="text-white/50">구매 후 잔액</span>
                <span className={cn('font-bold', points >= selectedProduct.price_krw ? 'text-green-400' : 'text-red-400')}>
                  {(points - selectedProduct.price_krw).toLocaleString()}P
                </span>
              </div>
            </div>

            {points < selectedProduct.price_krw ? (
              <div className="text-center py-3 text-red-400 text-sm mb-4">
                포인트가 {(selectedProduct.price_krw - points).toLocaleString()}P 부족해요
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setSelectedProduct(null) }}
                className="btn-outline flex-1 h-12"
              >
                취소
              </button>
              <button
                onClick={handlePurchase}
                disabled={purchasing || points < selectedProduct.price_krw}
                className="btn-brand flex-[2] h-12 flex items-center justify-center gap-2"
              >
                {purchasing ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />처리 중...</>
                ) : (
                  <><Check size={16} />구매하기</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
