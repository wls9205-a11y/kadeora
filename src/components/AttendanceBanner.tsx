'use client'
import { useState, useEffect } from 'react'

export default function AttendanceBanner() {
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/attendance')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.already_today && !d.error) setShow(true)
      })
      .catch(() => {})
  }, [])

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance', { method: 'POST' })
      if (res.ok) {
        setDone(true)
        setTimeout(() => setShow(false), 3000)
      }
    } catch {}
    finally { setLoading(false) }
  }

  if (!show) return null

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(255,69,0,0.12), rgba(255,69,0,0.06))',
      borderBottom: '1px solid rgba(255,69,0,0.2)',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      borderRadius: 4,
    }}>
      <div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
          {done ? '✅ 출석 완료 +10P' : '🗓 오늘 출석체크 하셨나요?'}
        </div>
        {!done && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', marginTop: 2 }}>+10P 적립</div>
        )}
      </div>
      {!done && (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--brand)',
            color: 'var(--text-inverse)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : '출석하기'}
        </button>
      )}
    </div>
  )
}
