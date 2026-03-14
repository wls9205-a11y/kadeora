export const dynamic = 'force-dynamic'
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { X, ImagePlus, ChevronDown, Lock } from 'lucide-react'
import { cn, REGION_LABELS, generateSlug } from '@/lib/utils'

const CATEGORIES = [
  { id: 'local', label: '📍 지역' },
  { id: 'stock', label: '📈 주식' },
  { id: 'housing', label: '🏠 청약' },
  { id: 'free', label: '💬 자유' },
]

export default function WritePostPage() {
  const [category, setCategory] = useState('free')
  const [region, setRegion] = useState('national')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [stockTags, setStockTags] = useState<string[]>([])
  const [stockInput, setStockInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user, profile } = useAuthStore()
  const supabase = createClient()

  if (!user) {
    router.push('/login?next=/post/write')
    return null
  }

  function addStockTag() {
    const tag = stockInput.trim().toUpperCase()
    if (tag && !stockTags.includes(tag) && stockTags.length < 5) {
      setStockTags([...stockTags, tag])
      setStockInput('')
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (images.length + files.length > 5) {
      toast.error('이미지는 최대 5장')
      return
    }

    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `posts/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('images').upload(path, file)
      if (!error) setImages(prev => [...prev, path])
    }
  }

  async function handleSubmit() {
    if (!title.trim() || title.length < 2) {
      toast.error('제목을 입력해주세요')
      return
    }
    if (!content.trim() || content.length < 5) {
      toast.error('내용을 입력해주세요')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          category,
          region_id: region,
          city: profile?.residence_city ?? '',
          title: title.trim(),
          content: content.trim(),
          is_anonymous: isAnonymous,
          stock_tags: stockTags,
          images,
        })
        .select()
        .single()

      if (error) throw error

      // slug 업데이트
      const slug = generateSlug(title, data.id)
      await supabase.from('posts').update({ slug }).eq('id', data.id)

      toast.success('게시글이 등록됐어요')
      router.push(`/post/${slug}`)
    } catch {
      toast.error('등록 실패. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col max-w-mobile mx-auto bg-[#0F0F0F]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] sticky top-0 bg-[#0F0F0F]/95 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <X size={20} className="text-white/70" />
        </button>
        <span className="text-base font-semibold flex-1">글쓰기</span>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !content.trim()}
          className="btn-brand py-2 px-4 text-sm"
        >
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* 카테고리 + 지역 */}
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-base flex-1 text-sm"
          >
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="input-base flex-1 text-sm"
          >
            {Object.entries(REGION_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          maxLength={100}
          className="input-base text-[17px] font-semibold"
        />

        {/* 내용 */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요..."
          rows={10}
          className="input-base resize-none text-[15px] leading-relaxed"
        />

        {/* 주식 태그 (주식 카테고리일 때) */}
        {category === 'stock' && (
          <div>
            <p className="text-xs text-white/40 mb-2">종목 태그 (최대 5개)</p>
            <div className="flex gap-2">
              <input
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addStockTag()}
                placeholder="종목코드 (예: 005930)"
                className="input-base flex-1 text-sm"
              />
              <button onClick={addStockTag} className="btn-outline px-3 py-2 text-sm">추가</button>
            </div>
            {stockTags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {stockTags.map(tag => (
                  <span key={tag} className="badge-bull flex items-center gap-1">
                    #{tag}
                    <button onClick={() => setStockTags(prev => prev.filter(t => t !== tag))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 이미지 첨부 */}
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
          {images.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto">
              {images.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-xl bg-[#252525] overflow-hidden" />
                  <button
                    onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 5}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <ImagePlus size={16} />
            사진 추가 ({images.length}/5)
          </button>
        </div>

        {/* 익명 토글 */}
        <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-white/40" />
            <span className="text-sm text-white/60">익명으로 작성</span>
          </div>
          <button
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={cn(
              'w-11 h-6 rounded-full transition-all duration-200 relative',
              isAnonymous ? 'bg-brand' : 'bg-white/10'
            )}
          >
            <span className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
              isAnonymous ? 'left-6' : 'left-1'
            )} />
          </button>
        </div>
      </div>
    </div>
  )
}
