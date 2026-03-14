'use client'

import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'

const MOCK_NOTIFICATIONS = [
  { id: '1', type: 'like', text: '투자의신님이 회원님의 글을 추천했어요', time: '5분 전', icon: '❤️' },
  { id: '2', type: 'comment', text: '차트분석가님이 댓글을 남겼어요: "좋은 분석이네요"', time: '23분 전', icon: '💬' },
  { id: '3', type: 'follow', text: '부린이탈출님이 회원님을 팔로우했어요', time: '1시간 전', icon: '👤' },
  { id: '4', type: 'grade', text: '축하해요! 등급이 🌿줄기에서 🌸꽃봉오리로 올랐어요!', time: '3시간 전', icon: '🎉' },
  { id: '5', type: 'system', text: '3월 부동산 분양 일정이 업데이트되었습니다', time: '5시간 전', icon: '📢' },
]

export default function NotificationsPage() {
  const { C } = useTheme()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader title="알림" />
      
      <div className="scrollable" style={{ flex: 1 }}>
        {MOCK_NOTIFICATIONS.map((notif, i) => (
          <div
            key={notif.id}
            className="fade-in press-effect"
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${C.w03}`,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              cursor: 'pointer',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{notif.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, color: C.w70, lineHeight: 1.5 }}>{notif.text}</p>
              <p style={{ fontSize: 11, color: C.w20, marginTop: 4 }}>{notif.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
