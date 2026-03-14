import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function timeAgo(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}주 전`
  return `${Math.floor(diff / 2592000)}개월 전`
}

export function formatNumber(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}만`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}천`
  return String(n)
}

export function formatPrice(n: number): string {
  return n.toLocaleString('ko-KR')
}

export const REGIONS = [
  '전국', '서울', '경기', '부산', '인천', '대구', '대전',
  '광주', '울산', '세종', '강원', '충북', '충남',
  '전북', '전남', '경북', '경남', '제주'
] as const

export const CATEGORIES = [
  { id: 'hot', label: '핫', icon: '🔥' },
  { id: 'local', label: '지역', icon: '📍' },
  { id: 'stock', label: '주식', icon: '📈' },
  { id: 'housing', label: '부동산', icon: '🏠' },
  { id: 'free', label: '자유', icon: '💬' },
] as const

export const GRADES = {
  1:  { name: '씨앗',     badge: '🪨', color: '#9CA3AF', grad: ['#6B7280','#9CA3AF'],  glow: false, min: 0,     perk: '커뮤니티 입문' },
  2:  { name: '새싹',     badge: '🌱', color: '#34D399', grad: ['#34D399','#6EE7B7'],  glow: false, min: 100,   perk: '댓글 무제한 작성' },
  3:  { name: '줄기',     badge: '🌿', color: '#60A5FA', grad: ['#3B82F6','#60A5FA'],  glow: false, min: 300,   perk: '프로필 배경 변경' },
  4:  { name: '꽃봉오리', badge: '🌸', color: '#C084FC', grad: ['#A855F7','#C084FC'],  glow: false, min: 700,   perk: '닉네임 색상 변경' },
  5:  { name: '개화',     badge: '🌺', color: '#FBBF24', grad: ['#F59E0B','#FDE68A'],  glow: true,  min: 1500,  perk: '게시글 상단 노출 +1회/월' },
  6:  { name: '열매',     badge: '🍊', color: '#F97316', grad: ['#EA580C','#FB923C'],  glow: true,  min: 3000,  perk: '전용 오렌지 닉네임 테두리' },
  7:  { name: '불꽃',     badge: '🔥', color: '#EF4444', grad: ['#DC2626','#F87171'],  glow: true,  min: 5000,  perk: '게시글 HOT 우선 노출' },
  8:  { name: '다이아',   badge: '💎', color: '#EC4899', grad: ['#DB2777','#F472B6'],  glow: true,  min: 8000,  perk: '프리미엄 배지 · 전용 채팅방' },
  9:  { name: '성좌',     badge: '🌌', color: '#818CF8', grad: ['#6366F1','#A5B4FC'],  glow: true,  min: 12000, perk: '광고 없음 · 전용 닉네임 이펙트' },
  10: { name: '전설',     badge: '👑', color: '#FFD700', grad: ['#B45309','#F59E0B','#FDE68A'], glow: true, min: 20000, perk: '전설 전용 테두리 · 모든 기능 무제한' },
} as const

export type GradeLevel = keyof typeof GRADES

export function getGradeInfo(grade: number) {
  return GRADES[Math.min(Math.max(grade, 1), 10) as GradeLevel]
}

export function getGradeColor(grade: number): string {
  return getGradeInfo(grade).color
}

export function calculateGrade(influence: number): number {
  const entries = Object.entries(GRADES) as [string, typeof GRADES[1]][]
  let grade = 1
  for (const [level, info] of entries) {
    if (influence >= info.min) {
      grade = parseInt(level)
    }
  }
  return grade
}
