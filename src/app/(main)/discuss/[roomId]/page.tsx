'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'
import { Avatar } from '@/components/ui'
import { SendIcon } from '@/components/ui/Icons'
import { getGradeInfo } from '@/lib/utils'

const MOCK_MESSAGES = [
  { id: '1', author: '주식고수', content: '오늘 삼전 분위기 좋네요 🚀', time: '10:23', grade: 6, isMe: false, isAnon: false },
  { id: '2', author: '나', content: '8만전자 때 물타기 했는데 드디어 수익이!', time: '10:24', grade: 4, isMe: true, isAnon: false },
  { id: '3', author: '차트장인', content: '볼린저밴드 상단 돌파했어요. 단기 목표가 9만원', time: '10:25', grade: 8, isMe: false, isAnon: false },
  { id: '4', author: '익명', content: '저는 아직 관망중입니다... 고점 물리기 무서워요 😅', time: '10:26', grade: 0, isMe: false, isAnon: true },
  { id: '5', author: '나', content: '기관 순매수 들어오는거 보면 아직 갈 수 있을듯', time: '10:28', grade: 4, isMe: true, isAnon: false },
  { id: '6', author: '반도체매니아', content: 'HBM 관련 뉴스 보셨나요? SK하이닉스도 같이 갈 것 같아요', time: '10:30', grade: 5, isMe: false, isAnon: false },
]

export default function DiscussRoomPage() {
  const params = useParams()
  const { C } = useTheme()
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [isAnon, setIsAnon] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!inputText.trim()) return

    const newMsg = {
      id: Date.now().toString(),
      author: isAnon ? '익명' : '나',
      content: inputText,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      grade: isAnon ? 0 : 4,
      isMe: true,
      isAnon,
    }

    setMessages(prev => [...prev, newMsg])
    setInputText('')
  }

  const roomName = params.roomId === '1' ? '삼성전자' : '토론방'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader
        title={roomName}
        right={
          <span style={{ fontSize: 12, color: C.w35, paddingRight: 8 }}>
            👥 3,247
          </span>
        }
      />

      {/* 메시지 영역 */}
      <div
        className="scrollable"
        style={{
          flex: 1,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1]
          const showHeader = !prevMsg || prevMsg.author !== msg.author || prevMsg.isMe !== msg.isMe
          const gradeInfo = getGradeInfo(msg.grade)

          return (
            <div
              key={msg.id}
              className="fade-in"
              style={{
                display: 'flex',
                flexDirection: msg.isMe ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: showHeader ? 10 : 2,
                animationDelay: `${i * 0.03}s`,
              }}
            >
              {/* 아바타 */}
              {!msg.isMe && showHeader && (
                <Avatar
                  name={msg.author}
                  grade={msg.grade}
                  size={32}
                  isAnon={msg.isAnon}
                />
              )}
              {!msg.isMe && !showHeader && <div style={{ width: 32 }} />}

              {/* 메시지 */}
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: msg.isMe ? 'flex-end' : 'flex-start' }}>
                {showHeader && !msg.isMe && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, padding: '0 4px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.w70 }}>{msg.author}</span>
                    {!msg.isAnon && (
                      <span style={{ fontSize: 10, color: gradeInfo.color }}>{gradeInfo.badge}</span>
                    )}
                  </div>
                )}
                <div
                  style={{
                    padding: '9px 14px',
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.45,
                    ...(msg.isMe
                      ? {
                          background: `linear-gradient(135deg, ${C.brand}, ${C.brandLight})`,
                          color: 'white',
                          borderBottomRightRadius: 4,
                        }
                      : {
                          background: C.s2,
                          color: C.w90,
                          borderBottomLeftRadius: 4,
                        }),
                  }}
                >
                  {msg.content}
                </div>
                {showHeader && (
                  <span style={{ fontSize: 10, color: C.w10, marginTop: 2, padding: '0 4px' }}>
                    {msg.time}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* 입력 영역 */}
      <div
        style={{
          padding: '10px 12px 16px',
          borderTop: `1px solid ${C.w05}`,
          flexShrink: 0,
          background: C.bg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {/* 익명 토글 */}
          <button
            onClick={() => setIsAnon(!isAnon)}
            title={isAnon ? '익명 해제' : '익명으로 전송'}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: `1.5px solid ${isAnon ? C.brand : C.w10}`,
              cursor: 'pointer',
              background: isAnon ? `${C.brand}15` : 'transparent',
              color: isAnon ? C.brand : C.w35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            🔒
          </button>

          {/* 입력창 */}
          <div
            style={{
              flex: 1,
              background: isAnon ? `${C.brand}08` : C.s2,
              borderRadius: 18,
              border: `1px solid ${isAnon ? C.brand + '30' : C.w05}`,
              padding: '8px 14px',
              transition: 'all 0.2s',
            }}
          >
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={isAnon ? '익명으로 입력 중...' : '메시지 입력...'}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: C.text,
                fontSize: 14,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: C.w10 }}>{inputText.length}/500</span>
            </div>
          </div>

          {/* 전송 버튼 */}
          <button
            onClick={sendMessage}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              background: inputText.trim() ? C.brand : C.w05,
              color: inputText.trim() ? 'white' : C.w20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
