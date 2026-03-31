'use client'
import { useState, useEffect } from 'react'

export default function AttendanceBanner() {
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    fetch('/api/attendance')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.already_today && !d.error) setShow(true)
        if (d && d.current_streak) setStreak(d.current_streak)
      })
      .catch(() => {})
  }, [])

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance', { method: 'POST' })
      if (res.ok) {
        setDone(true)
        setStreak(s => s + 1)
        setTimeout(() => setShow(false), 3000)
      }
    } catch {}
    finally { setLoading(false) }
  }

  if (!show) return null

  const weekDay = streak % 7 || 7
  const REWARDS = ['', '10P', '10P', '10P', '15P', '15P', '20P', '50P']

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(52,211,153,0.06) 100%)',
      border: '1px solid rgba(37,99,235,0.15)',
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      marginBottom: 10, borderRadius: 'var(--radius-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>
            {done ? '\u2705 출석 완료!' : '\ud83d\udcc5 오늘 출석체크'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 2, fontWeight: 600 }}>
            {done ? `+${REWARDS[weekDay]}P 적립` : `오늘 +${REWARDS[Math.min(weekDay + 1, 7)]}P`}
            {streak > 0 && <span style={{ marginLeft: 6, color: 'var(--accent-orange)' }}>\ud83d\udd25 {streak}일 연속</span>}
          </div>
        </div>
        {!done && (
          <button onClick={handleCheckIn} disabled={loading} style={{
            padding: '8px 18px', borderRadius: 'var(--radius-xl)', border: 'none',
            background: 'var(--brand)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, transition: 'all var(--transition-fast)',
          }}>
            {loading ? '...' : '\u2728 출석'}
          </button>
        )}
      </div>
      {/* 7일 진행률 */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3,4,5,6,7].map(d => {
          const filled = d <= weekDay
          return (
            <div key={d} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: filled ? (d === 7 ? 'var(--accent-orange)' : 'var(--accent-green)') : 'var(--bg-hover)',
              transition: 'background 0.2s',
            }} />
          )
        })}
      </div>
    </div>
  )
}
