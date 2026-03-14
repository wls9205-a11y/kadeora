'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { Logo, Button, Spinner } from '@/components/ui'
import { REGIONS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const INTERESTS = ['주식', '부동산', '청약', '재테크', '배당', '가치투자', '단기매매', '해외주식']

export default function OnboardingPage() {
  const router = useRouter()
  const { C } = useTheme()
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [region, setRegion] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 5 ? [...prev, interest] : prev
    )
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: authData } = await supabase.auth.getUser()
      
      if (authData.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any).update({
          nickname: nickname,
          region_text: region,
          interests: interests,
          onboarded: true,
          nickname_set: true,
          points: 50,
        }).eq('id', authData.user.id)
      }
      
      router.push('/feed')
    } catch (error) {
      console.error('Onboarding error:', error)
      setLoading(false)
    }
  }

  return (
    <div
      className="mobile-container"
      style={{
        background: C.bg,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <Logo size={36} />
        <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>카더라</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: s <= step ? C.brand : C.w10,
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            반가워요! 👋
          </h1>
          <p style={{ fontSize: 14, color: C.w50, marginBottom: 32 }}>
            카더라에서 사용할 닉네임을 정해주세요
          </p>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="닉네임 (2~12자)"
            maxLength={12}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: '1px solid ' + C.w10,
              background: C.s2,
              color: C.text,
              fontSize: 16,
              padding: '0 16px',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 12, color: C.w20, marginTop: 8 }}>
            {nickname.length}/12자
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            어디에 살고 계세요? 📍
          </h1>
          <p style={{ fontSize: 14, color: C.w50, marginBottom: 32 }}>
            지역 기반 콘텐츠를 추천해 드릴게요
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {REGIONS.filter(r => r !== '전국').map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                style={{
                  padding: '14px 0',
                  borderRadius: 12,
                  border: region === r ? '1.5px solid ' + C.brand : '1.5px solid transparent',
                  background: region === r ? C.brand + '15' : C.w05,
                  color: region === r ? C.brand : C.w50,
                  fontSize: 14,
                  fontWeight: region === r ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            관심사를 선택해주세요 ✨
          </h1>
          <p style={{ fontSize: 14, color: C.w50, marginBottom: 32 }}>
            최대 5개까지 선택할 수 있어요
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {INTERESTS.map(interest => {
              const selected = interests.includes(interest)
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 24,
                    border: selected ? '1.5px solid ' + C.brand : '1.5px solid transparent',
                    background: selected ? C.brand + '15' : C.w05,
                    color: selected ? C.brand : C.w50,
                    fontSize: 14,
                    fontWeight: selected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {interest}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 12, color: C.w20, marginTop: 16 }}>
            {interests.length}/5개 선택됨
          </p>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        {step < 3 ? (
          <Button
            primary
            full
            disabled={
              (step === 1 && nickname.length < 2) ||
              (step === 2 && !region)
            }
            onClick={() => setStep(step + 1)}
          >
            다음
          </Button>
        ) : (
          <Button
            primary
            full
            disabled={interests.length === 0 || loading}
            onClick={handleComplete}
          >
            {loading ? <Spinner /> : '시작하기 🎉'}
          </Button>
        )}
        
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{
              width: '100%',
              marginTop: 12,
              padding: 14,
              background: 'none',
              border: 'none',
              color: C.w35,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            이전으로
          </button>
        )}
      </div>
    </div>
  )
}
