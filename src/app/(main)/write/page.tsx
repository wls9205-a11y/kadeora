'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'
import { CATEGORIES } from '@/lib/utils'

export default function WritePage() {
  const router = useRouter()
  const { C } = useTheme()
  const [category, setCategory] = useState('free')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isAnon, setIsAnon] = useState(false)
  const [tags, setTags] = useState('')

  const canPost = title.trim() && content.trim()

  const handleSubmit = () => {
    if (!canPost) return
    // TODO: 실제 게시 로직
    alert('게시글이 작성되었습니다!')
    router.push('/feed')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader
        title="글쓰기"
        right={
          <button
            onClick={handleSubmit}
            disabled={!canPost}
            style={{
              padding: '7px 18px',
              borderRadius: 10,
              border: 'none',
              background: canPost ? C.brand : C.w05,
              color: canPost ? 'white' : C.w20,
              fontSize: 14,
              fontWeight: 700,
              cursor: canPost ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            게시
          </button>
        }
      />

      {/* 카테고리 선택 */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          borderBottom: `1px solid ${C.w05}`,
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {CATEGORIES.filter(c => c.id !== 'hot').map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              border: `1.5px solid ${category === cat.id ? C.brand : 'transparent'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: category === cat.id ? `${C.brand}15` : C.w05,
              color: category === cat.id ? C.brand : C.w50,
              transition: 'all 0.15s',
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      <div className="scrollable" style={{ flex: 1, padding: 16 }}>
        {/* 제목 */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            borderBottom: `1px solid ${C.w05}`,
            color: C.text,
            fontSize: 17,
            fontWeight: 700,
            padding: '12px 0',
            outline: 'none',
            marginBottom: 12,
          }}
        />

        {/* 내용 */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          style={{
            width: '100%',
            minHeight: 200,
            background: 'none',
            border: 'none',
            color: C.text,
            fontSize: 15,
            lineHeight: 1.7,
            outline: 'none',
            resize: 'none',
          }}
        />

        {/* 태그 입력 */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, color: C.w35, marginBottom: 8 }}>태그 (쉼표로 구분)</p>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="예: 삼성전자, 반도체"
            style={{
              width: '100%',
              height: 40,
              borderRadius: 12,
              border: `1px solid ${C.w05}`,
              background: C.s2,
              color: C.text,
              fontSize: 14,
              padding: '0 14px',
              outline: 'none',
            }}
          />
        </div>

        {/* 익명 토글 */}
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            background: C.s2,
            border: `1px solid ${C.w05}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>🔒 익명으로 작성</p>
            <p style={{ fontSize: 11, color: C.w35, marginTop: 2 }}>프로필과 등급이 표시되지 않습니다</p>
          </div>
          <button
            onClick={() => setIsAnon(!isAnon)}
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              background: isAnon ? C.brand : C.w10,
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: 'white',
                position: 'absolute',
                top: 3,
                left: isAnon ? 23 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
