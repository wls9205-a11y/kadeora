'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { REGIONS } from '@/lib/utils'

export default function ProfileEditPage() {
  const router = useRouter()
  const { C } = useTheme()
  const [nickname, setNickname] = useState('투자의신')
  const [bio, setBio] = useState('주식/부동산 10년차 투자자. 가치투자와 지역 분석을 좋아합니다.')
  const [region, setRegion] = useState('서울')
  const [interests, setInterests] = useState(['주식', '부동산'])

  const interestOptions = ['주식', '부동산', '청약', '재테크', '배당', '가치투자', '단기매매', '해외주식']

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : prev.length < 5 ? [...prev, interest] : prev
    )
  }

  const handleSave = () => {
    // TODO: 실제 저장 로직
    alert('프로필이 저장되었습니다!')
    router.back()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader
        title="프로필 편집"
        right={
          <button
            onClick={handleSave}
            style={{
              padding: '7px 16px',
              borderRadius: 10,
              border: 'none',
              background: C.brand,
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        }
      />

      <div className="scrollable" style={{ flex: 1, padding: 16 }}>
        {/* 아바타 변경 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${C.brand}, ${C.brandLight})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 900,
              color: 'white',
              marginBottom: 12,
            }}
          >
            {nickname[0]}
          </div>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: `1px solid ${C.w10}`,
              background: 'transparent',
              color: C.w50,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📷 사진 변경
          </button>
        </div>

        {/* 닉네임 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.w50, marginBottom: 8 }}>
            닉네임
          </label>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={12}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              border: `1px solid ${C.w10}`,
              background: C.s2,
              color: C.text,
              fontSize: 15,
              padding: '0 14px',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 11, color: C.w20, marginTop: 6 }}>{nickname.length}/12자</p>
        </div>

        {/* 소개 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.w50, marginBottom: 8 }}>
            소개
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={100}
            rows={3}
            style={{
              width: '100%',
              borderRadius: 12,
              border: `1px solid ${C.w10}`,
              background: C.s2,
              color: C.text,
              fontSize: 14,
              padding: 14,
              outline: 'none',
              resize: 'none',
              lineHeight: 1.5,
            }}
          />
          <p style={{ fontSize: 11, color: C.w20, marginTop: 6 }}>{bio.length}/100자</p>
        </div>

        {/* 지역 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.w50, marginBottom: 8 }}>
            지역
          </label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              border: `1px solid ${C.w10}`,
              background: C.s2,
              color: C.text,
              fontSize: 15,
              padding: '0 14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {REGIONS.filter(r => r !== '전국').map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* 관심사 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.w50, marginBottom: 8 }}>
            관심사 (최대 5개)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {interestOptions.map(interest => {
              const selected = interests.includes(interest)
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${selected ? C.brand : 'transparent'}`,
                    background: selected ? `${C.brand}15` : C.w05,
                    color: selected ? C.brand : C.w50,
                    fontSize: 13,
                    fontWeight: selected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {interest}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
