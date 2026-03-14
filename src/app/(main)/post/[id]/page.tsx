'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'
import { Avatar } from '@/components/ui'
import { HeartIcon, CommentIcon, BookmarkIcon, ShareIcon } from '@/components/ui/Icons'
import { formatNumber, getGradeInfo, CATEGORIES } from '@/lib/utils'

// 임시 데이터
const MOCK_POST = {
  id: '1',
  category: 'stock',
  title: '삼성전자 9만전자 가능할까요?',
  content: '반도체 사이클 회복기에 접어든 것 같은데 여러분 의견은? HBM 수요가 폭발적으로 늘고 있고 TSMC도 CAPEX를 늘리는 상황입니다.\n\n개인적으로는 하반기까지 충분히 9만원 도달 가능하다고 봅니다. 외국인 수급도 좋고, 반도체 슈퍼사이클 진입 가능성이 높아 보여요.',
  author: '투자의신',
  grade: 7,
  isPremium: true,
  isHot: true,
  isAnon: false,
  tags: ['삼성전자', '반도체'],
  likes: 342,
  comments: 89,
  views: 2841,
  time: '23분 전',
}

const MOCK_COMMENTS = [
  { id: '1', author: '개미투자자', grade: 5, content: '저도 같은 생각입니다. 반도체 사이클 회복이 관건이죠', time: '1시간 전', likes: 23, isAnon: false, isPremium: false },
  { id: '2', author: '매크로분석', grade: 6, content: '미국 금리 인하 사이클이랑 맞물리면 충분히 가능하다고 봅니다 👍', time: '2시간 전', likes: 45, isAnon: false, isPremium: true },
  { id: '3', author: '익명', grade: 0, content: '이미 많이 올라서 지금 들어가기엔 늦은 거 아닌가요?', time: '3시간 전', likes: 12, isAnon: true, isPremium: false },
]

export default function PostDetailPage() {
  const params = useParams()
  const { C } = useTheme()
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [commentText, setCommentText] = useState('')

  const gradeInfo = getGradeInfo(MOCK_POST.grade)
  const category = CATEGORIES.find(c => c.id === MOCK_POST.category)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader
        badge={category?.label}
        right={
          MOCK_POST.isHot && (
            <span style={{ fontSize: 11, color: '#F97316', fontWeight: 700, paddingRight: 6 }}>🔥 HOT</span>
          )
        }
      />

      <div className="scrollable" style={{ flex: 1 }}>
        {/* 작성자 정보 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <Avatar name={MOCK_POST.author} grade={MOCK_POST.grade} size={38} isAnon={MOCK_POST.isAnon} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{MOCK_POST.author}</span>
              {!MOCK_POST.isAnon && (
                <span style={{ fontSize: 11, color: gradeInfo.color, fontWeight: 600 }}>
                  {gradeInfo.badge} {gradeInfo.name}
                </span>
              )}
              {MOCK_POST.isPremium && <span style={{ fontSize: 10, color: '#FBBF24' }}>✦</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: C.w20 }}>
              <span>{MOCK_POST.time}</span>
              <span>·</span>
              <span>조회 {formatNumber(MOCK_POST.views)}</span>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: '0 16px 18px' }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: C.text, lineHeight: 1.4, marginBottom: 12 }}>
            {MOCK_POST.title}
          </h1>
          <p style={{ fontSize: 15, color: C.w70, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
            {MOCK_POST.content}
          </p>
          {MOCK_POST.tags && MOCK_POST.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {MOCK_POST.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(239,68,68,0.1)',
                    color: '#EF4444',
                    cursor: 'pointer',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 16px',
            borderTop: `1px solid ${C.w03}`,
            borderBottom: `1px solid ${C.w03}`,
          }}
        >
          <button
            onClick={() => setLiked(!liked)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 14px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: liked ? `${C.brand}15` : C.w05,
              color: liked ? C.brand : C.w50,
              transition: 'all 0.15s',
            }}
          >
            <HeartIcon filled={liked} /> {liked ? MOCK_POST.likes + 1 : MOCK_POST.likes}
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', color: C.w20, fontSize: 13 }}>
            <CommentIcon /> {MOCK_POST.comments}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setSaved(!saved)}
            style={{ padding: 7, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }}
          >
            <BookmarkIcon filled={saved} />
          </button>
          <button style={{ padding: 7, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }}>
            <ShareIcon />
          </button>
        </div>

        {/* 댓글 */}
        <div style={{ padding: '16px 16px 80px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            댓글 {MOCK_POST.comments}개
          </h3>
          {MOCK_COMMENTS.map((comment, i) => {
            const commentGrade = getGradeInfo(comment.grade)
            return (
              <div
                key={comment.id}
                className="fade-in"
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 16,
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <Avatar name={comment.author} grade={comment.grade} size={30} isAnon={comment.isAnon} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{comment.author}</span>
                    {!comment.isAnon && (
                      <span style={{ fontSize: 10, color: commentGrade.color, fontWeight: 500 }}>
                        Lv.{comment.grade}
                      </span>
                    )}
                    {comment.isPremium && <span style={{ fontSize: 10, color: '#FBBF24' }}>✦</span>}
                    <span style={{ fontSize: 11, color: C.w20, marginLeft: 'auto' }}>{comment.time}</span>
                  </div>
                  <p style={{ fontSize: 14, color: C.w70, lineHeight: 1.55 }}>{comment.content}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, color: C.w20, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <HeartIcon size={12} /> {comment.likes}
                    </span>
                    <span style={{ cursor: 'pointer' }}>답글</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 댓글 입력 */}
      <div
        style={{
          padding: '10px 14px 16px',
          borderTop: `1px solid ${C.w05}`,
          flexShrink: 0,
          background: C.bg,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="댓글을 남겨보세요..."
          style={{
            flex: 1,
            height: 38,
            borderRadius: 19,
            background: C.s2,
            border: `1px solid ${C.w05}`,
            color: C.text,
            fontSize: 14,
            paddingLeft: 14,
            outline: 'none',
          }}
        />
        <button
          style={{
            height: 38,
            padding: '0 16px',
            borderRadius: 19,
            border: 'none',
            background: commentText.trim() ? C.brand : C.w05,
            color: commentText.trim() ? 'white' : C.w20,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          등록
        </button>
      </div>
    </div>
  )
}
