'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Keyword {
  keyword: string
  heat_score?: number
  search_count?: number
}

export default function TrendingBar() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const router = useRouter()

  useEffect(() => {
    fetch('/api/search/trending')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.keywords) setKeywords(d.keywords.slice(0, 8)) })
      .catch(() => {})
  }, [])

  if (keywords.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      overflowX: 'auto',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      marginBottom: 10,
      borderRadius: 10,
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0 }}>
        🔥 지금 뜨는
      </span>
      {keywords.map((kw) => (
        <button
          key={kw.keyword}
          onClick={() => router.push(`/search?q=${encodeURIComponent(kw.keyword)}`)}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 16,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          {kw.keyword}
        </button>
      ))}
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  )
}
