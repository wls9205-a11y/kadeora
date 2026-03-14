'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'
import { Button } from '@/components/ui'

const SHOP_ITEMS = [
  { id: 'mega_basic', name: '확성기 (기본)', desc: '12시간 상단 노출', price: 100, icon: '📢', color: '#34D399' },
  { id: 'mega_urgent', name: '확성기 (긴급)', desc: '24시간 + 하이라이트', price: 300, icon: '⚡', color: '#EF4444' },
  { id: 'pin_24h', name: '게시글 고정', desc: '24시간 상단 고정', price: 200, icon: '📌', color: '#FBBF24' },
  { id: 'premium_30d', name: '프리미엄 30일', desc: '배지 + 혜택 모음', price: 500, icon: '👑', color: '#A78BFA' },
  { id: 'nickname', name: '닉네임 변경권', desc: '1회 닉네임 변경', price: 150, icon: '🔄', color: '#60A5FA' },
]

const POINT_METHODS = [
  ['매일 출석 체크', '+10P'],
  ['연속 출석 보너스 (7일)', '+30P'],
  ['게시글 좋아요 받기', '+1P'],
  ['프로필 완성', '+50P'],
  ['SNS 공유하기', '+5P'],
]

export default function ShopPage() {
  const { C } = useTheme()
  const [selectedItem, setSelectedItem] = useState<typeof SHOP_ITEMS[0] | null>(null)
  const userPoints = 3450

  const handlePurchase = () => {
    if (selectedItem && userPoints >= selectedItem.price) {
      // TODO: 실제 구매 로직
      alert(`${selectedItem.name}을(를) 구매했습니다!`)
      setSelectedItem(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader title="상점" />
      
      <div className="scrollable" style={{ flex: 1, padding: 14 }}>
        {/* 포인트 현황 */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            background: C.s2,
            border: `1px solid ${C.w05}`,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 24 }}>💎</span>
          <div>
            <p style={{ fontSize: 11, color: C.w35 }}>보유 포인트</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{userPoints.toLocaleString()}P</p>
          </div>
        </div>

        {/* 상품 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHOP_ITEMS.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="press-effect"
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: C.s2,
                border: `1px solid ${C.w05}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `${item.color}15`,
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{item.name}</p>
                <p style={{ fontSize: 12, color: C.w35, marginTop: 1 }}>{item.desc}</p>
              </div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: userPoints >= item.price ? C.text : C.w35,
                  flexShrink: 0,
                }}
              >
                {item.price}P
              </p>
            </div>
          ))}
        </div>

        {/* 포인트 얻는 법 */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 14, background: C.s2, border: `1px solid ${C.w05}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>💰 포인트 얻는 법</h3>
          {POINT_METHODS.map(([label, points]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 13, color: C.w50 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>{points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 구매 확인 바텀시트 */}
      {selectedItem && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 40,
              backdropFilter: 'blur(3px)',
            }}
            onClick={() => setSelectedItem(null)}
          />
          <div
            className="slide-up"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              background: C.s2,
              borderRadius: '20px 20px 0 0',
              border: `1px solid ${C.w05}`,
              padding: '24px 20px 32px',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.w10, margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>{selectedItem.name}</h3>
            <p style={{ fontSize: 13, color: C.w35, marginBottom: 18 }}>{selectedItem.desc}</p>
            
            <div style={{ padding: 14, borderRadius: 12, background: C.bg, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.w50 }}>상품 금액</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selectedItem.price}P</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.w50 }}>보유 포인트</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{userPoints}P</span>
              </div>
              <div style={{ height: 1, background: C.w05, margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: C.w50 }}>구매 후 잔액</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#34D399' }}>
                  {(userPoints - selectedItem.price).toLocaleString()}P
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => setSelectedItem(null)} style={{ flex: 1 }}>취소</Button>
              <Button primary onClick={handlePurchase} style={{ flex: 2 }}>구매하기</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
