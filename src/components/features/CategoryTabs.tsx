'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Flame, MapPin, TrendingUp, Building2, AlignJustify } from 'lucide-react'

const CATEGORIES = [
  { id: 'hot', label: '핫', icon: Flame },
  { id: 'local', label: '지역', icon: MapPin },
  { id: 'stock', label: '주식', icon: TrendingUp },
  { id: 'housing', label: '청약', icon: Building2 },
  { id: 'free', label: '자유', icon: AlignJustify },
]

interface CategoryTabsProps {
  currentCategory: string
}

export function CategoryTabs({ currentCategory }: CategoryTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleSelect(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('category', id)
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="sticky top-[86px] z-20 bg-[#0F0F0F]/95 backdrop-blur-md
                    border-b border-white/[0.06]">
      <div className="flex overflow-x-auto scrollbar-hide">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const isActive = currentCategory === id
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap',
                'border-b-2 transition-all duration-150',
                isActive
                  ? 'border-brand text-white'
                  : 'border-transparent text-white/40 hover:text-white/60'
              )}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
