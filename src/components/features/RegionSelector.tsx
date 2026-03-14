'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { REGIONS } from '@/lib/utils'
import { CloseIcon } from '@/components/ui/Icons'

interface RegionSelectorProps {
  isOpen: boolean
  onClose: () => void
  selected: string[]
  onSelect: (regions: string[]) => void
  maxSelect?: number
}

export function RegionSelector({ 
  isOpen, 
  onClose, 
  selected, 
  onSelect,
  maxSelect = 3 
}: RegionSelectorProps) {
  const { C } = useTheme()
  const [localSelected, setLocalSelected] = useState<string[]>(selected)

  useEffect(() => {
    setLocalSelected(selected)
  }, [selected])

  const toggleRegion = (region: string) => {
    if (region === '전국') {
      setLocalSelected(['전국'])
      return
    }

    setLocalSelected(prev => {
      const without = prev.filter(x => x !== '전국')
      if (without.includes(region)) {
        const next = without.filter(x => x !== region)
        return next.length === 0 ? ['전국'] : next
      }
      if (without.length >= maxSelect) return prev
      return [...without, region]
    })
  }

  const handleConfirm = () => {
    onSelect(localSelected)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* 백드롭 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.65)',
        }}
        onClick={onClose}
      />

      {/* 바텀시트 */}
      <div
        className="slide-up"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 430,
          zIndex: 60,
          background: C.s1,
          borderRadius: '20px 20px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>지역 선택</h3>
            <p style={{ fontSize: 11, color: C.w20, marginTop: 2 }}>최대 {maxSelect}개까지 선택 가능해요</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ height: 1, background: C.w05, margin: '0 0 12px' }} />

        {/* 지역 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '0 14px 20px' }}>
          {REGIONS.map(region => {
            const isSelected = localSelected.includes(region)
            const isMaxed = !localSelected.includes('전국') && localSelected.length >= maxSelect && !isSelected
            
            return (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                disabled={isMaxed}
                style={{
                  padding: '10px 0',
                  borderRadius: 10,
                  border: `1.5px solid ${isSelected ? C.brand : 'transparent'}`,
                  background: isSelected ? `${C.brand}20` : isMaxed ? C.w03 : C.w05,
                  color: isSelected ? C.brand : isMaxed ? C.w20 : C.w50,
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: isMaxed ? 'default' : 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {region}
              </button>
            )
          })}
        </div>

        {/* 확인 버튼 */}
        <div style={{ padding: '0 14px 16px' }}>
          <button
            onClick={handleConfirm}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              border: 'none',
              background: C.brand,
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {localSelected.includes('전국') ? '전국 선택' : `${localSelected.length}개 지역 선택`} 완료
          </button>
        </div>
      </div>
    </>
  )
}
