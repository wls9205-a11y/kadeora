'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, MapPin } from 'lucide-react'
import { useState } from 'react'
import { REGION_LABELS, cn } from '@/lib/utils'

interface RegionSelectorProps {
  currentRegion: string
}

export function RegionSelector({ currentRegion }: RegionSelectorProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  function selectRegion(regionId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('region', regionId)
    router.push(`/?${params.toString()}`)
    setOpen(false)
  }

  const currentLabel = REGION_LABELS[currentRegion] ?? currentRegion

  return (
    <div className="relative px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.04]">
      <MapPin size={13} className="text-white/40" />
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
      >
        {currentLabel}
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {/* 드롭다운 */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 z-40 mt-1 mx-3
                          bg-[#1A1A1A] border border-white/[0.08] rounded-xl
                          shadow-xl shadow-black/50 overflow-hidden
                          animate-slide-down">
            <div className="grid grid-cols-4 p-2 gap-1">
              {/* 전국 */}
              <button
                onClick={() => selectRegion('national')}
                className={cn(
                  'col-span-4 py-2 text-sm rounded-lg transition-colors',
                  currentRegion === 'national'
                    ? 'bg-brand/20 text-brand font-semibold'
                    : 'text-white/60 hover:bg-white/5'
                )}
              >
                전국
              </button>

              {Object.entries(REGION_LABELS)
                .filter(([id]) => id !== 'national')
                .map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => selectRegion(id)}
                    className={cn(
                      'py-2 text-sm rounded-lg transition-colors',
                      currentRegion === id
                        ? 'bg-brand/20 text-brand font-semibold'
                        : 'text-white/60 hover:bg-white/5'
                    )}
                  >
                    {label}
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
