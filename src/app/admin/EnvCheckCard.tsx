'use client'
import { useState, useEffect } from 'react'

interface EnvVar {
  key: string
  set: boolean
}

interface EnvCheckData {
  serverVars: EnvVar[]
  publicVars: EnvVar[]
  nextPublicVarNames: string[]
}

export default function EnvCheckCard() {
  const [data, setData] = useState<EnvCheckData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/env-check')
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError('환경변수 점검 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const allVars = data ? [...data.serverVars, ...data.publicVars] : []
  const missingCount = allVars.filter(v => !v.set).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔧 시스템 환경변수 점검
        </h2>
        <button onClick={load} disabled={loading}
          style={{ fontSize: 'var(--fs-sm)', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {loading ? '...' : '새로고침'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--error)', fontSize: 'var(--fs-sm)', marginBottom: 8 }}>{error}</div>}

      {data && missingCount > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--error-bg, rgba(248,113,113,0.08))', border: '1px solid var(--error, #FF6B6B)', marginBottom: 12, fontSize: 'var(--fs-sm)', color: 'var(--error, #FF6B6B)', fontWeight: 600 }}>
          ⚠️ 미설정 환경변수 {missingCount}개 — 일부 기능이 동작하지 않을 수 있습니다
        </div>
      )}

      {data && (
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>환경변수</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, width: 80, textAlign: 'center' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {allVars.map((v, i) => (
                <tr key={v.key} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}>
                    {v.key.length > 25 ? v.key.slice(0, 22) + '...' : v.key}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: v.set ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.08)',
                      color: v.set ? '#059669' : 'var(--accent-red)',
                    }}>
                      {v.set ? '✅ 설정됨' : '❌ 미설정'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
