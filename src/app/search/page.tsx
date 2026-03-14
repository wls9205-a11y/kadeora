'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/features/PostCard'
import { cn, timeAgo } from '@/lib/utils'
import type { PostWithAuthor } from '@/types/database'

const RECENT_KEY = 'kadeora_recent_searches'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PostWithAuthor[]>([])
  const [searching, setSearching] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    setRecent(saved)
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); return }

    timer.current = setTimeout(() => doSearch(query), 350)
    return () => clearTimeout(timer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function doSearch(q: string) {
    setSearching(true)
    const { data } = await supabase
      .from('posts')
      .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title, is_premium)`)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30)

    setResults((data ?? []) as PostWithAuthor[])
    setSearching(false)

    // 최근 검색어 저장
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 10)
    setRecent(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  }

  function removeRecent(term: string) {
    const updated = recent.filter(r => r !== term)
    setRecent(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  }

  return (
    <div className="min-h-dvh max-w-mobile mx-auto bg-[#0F0F0F]">
      {/* 검색창 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] sticky top-0 bg-[#0F0F0F]/95 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="text-white/50 text-sm flex-shrink-0">취소</button>
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="검색어 입력"
            className="input-base pl-9 h-10 text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={15} className="text-white/30" />
            </button>
          )}
        </div>
      </div>

      {/* 최근 검색어 */}
      {!query && recent.length > 0 && (
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white/60">최근 검색</span>
            <button
              onClick={() => { setRecent([]); localStorage.removeItem(RECENT_KEY) }}
              className="text-xs text-white/30 hover:text-white/50"
            >
              전체 삭제
            </button>
          </div>
          <div className="space-y-1">
            {recent.map(term => (
              <div key={term} className="flex items-center gap-3 py-2">
                <Clock size={13} className="text-white/25 flex-shrink-0" />
                <button
                  onClick={() => setQuery(term)}
                  className="flex-1 text-sm text-white/70 text-left"
                >
                  {term}
                </button>
                <button onClick={() => removeRecent(term)}>
                  <X size={13} className="text-white/25 hover:text-white/50" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검색 중 */}
      {searching && (
        <div className="py-10 text-center text-white/30 text-sm">검색 중...</div>
      )}

      {/* 검색 결과 */}
      {!searching && query && (
        <>
          <div className="px-4 py-3 text-sm text-white/40">
            '{query}' 검색 결과 {results.length}개
          </div>
          <div className="divide-y divide-white/[0.04]">
            {results.length > 0 ? (
              results.map(post => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="py-16 text-center text-white/30">
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-sm">검색 결과가 없어요</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
