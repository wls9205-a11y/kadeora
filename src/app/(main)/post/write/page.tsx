'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { X, ImagePlus, Lock } from 'lucide-react'
import { cn, REGION_LABELS, generateSlug } from '@/lib/utils'

const CATEGORIES = [
  { id: 'local', label: '\uD83D\uDCCD \uC9C0\uC5ED' },
  { id: 'stock', label: '\uD83D\uDCC8 \uC8FC\uC2DD' },
  { id: 'housing', label: '\uD83C\uDFE0 \uCCAD\uC57D' },
  { id: 'free', label: '\uD83D\uDCAC \uC790\uC720' },
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
    if (images.length + files.length > 5) { toast.error('\uC774\uBBF8\uC9C0\uB294 \uCD5C\uB300 5\uC7A5'); return }
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `posts/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('images').upload(path, file)
      if (!error) setImages(prev => [...prev, path])
    }
  }

  async function handleSubmit() {
    if (!title.trim() || title.length < 2) { toast.error('\uC81C\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'); return }
    if (!content.trim() || content.length < 5) { toast.error('\uB0B4\uC6A9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'); return }
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
      const slug = generateSlug(title, data.id)
      await supabase.from('posts').update({ slug }).eq('id', data.id)
      toast.success('\uAC8C\uC2DC\uAE00\uC774 \uB4F1\uB85D\uB410\uC5B4\uC694')
      router.push(`/post/${slug}`)
    } catch {
      toast.error('\uB4F1\uB85D \uC2E4\uD328. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col max-w-mobile mx-auto bg-[#0F0F0F]">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] sticky top-0 bg-[#0F0F0F]/95 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <X size={20} className="text-white/70" />
        </button>
        <span className="text-base font-semibold flex-1">\uAE00\uC4F0\uAE30</span>
        <button onClick={handleSubmit} disabled={submitting || !title.trim() || !content.trim()} className="btn-brand py-2 px-4 text-sm">
          {submitting ? '\uB4F1\uB85D \uC911...' : '\uB4F1\uB85D'}
        </button>
      </div>
      <div className="flex-1 px-4 py-4 space-y-4">
        <div className="flex gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base flex-1 text-sm">
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="input-base flex-1 text-sm">
            {Object.entries(REGION_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="\uC81C\uBAA9" maxLength={100} className="input-base text-[17px] font-semibold" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="\uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694..." rows={10} className="input-base resize-none text-[15px] leading-relaxed" />
        {category === 'stock' && (
          <div>
            <p className="text-xs text-white/40 mb-2">\uC885\uBAA9 \uD0DC\uADF8 (\uCD5C\uB300 5\uAC1C)</p>
            <div className="flex gap-2">
              <input value={stockInput} onChange={(e) => setStockInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && addStockTag()} placeholder="\uC885\uBAA9\uCF54\uB4DC" className="input-base flex-1 text-sm" />
              <button onClick={addStockTag} className="btn-outline px-3 py-2 text-sm">\uCD94\uAC00</button>
            </div>
            {stockTags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {stockTags.map(tag => (
                  <span key={tag} className="badge-bull flex items-center gap-1">#{tag}<button onClick={() => setStockTags(prev => prev.filter(t => t !== tag))}><X size={10} /></button></span>
                ))}
              </div>
            )}
          </div>
        )}
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={images.length >= 5} className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors">
            <ImagePlus size={16} />
            \uC0AC\uC9C4 \uCD94\uAC00 ({images.length}/5)
          </button>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-white/40" />
            <span className="text-sm text-white/60">\uC775\uBA85\uC73C\uB85C \uC791\uC131</span>
          </div>
          <button onClick={() => setIsAnonymous(!isAnonymous)} className={cn('w-11 h-6 rounded-full transition-all duration-200 relative', isAnonymous ? 'bg-brand' : 'bg-white/10')}>
            <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200', isAnonymous ? 'left-6' : 'left-1')} />
          </button>
        </div>
      </div>
    </div>
  )
}
