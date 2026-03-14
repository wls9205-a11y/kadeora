import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

// Tailwind 클래스 병합
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 한국 시간 기준 상대 시간
export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko })
}

// 숫자 단위 변환 (1.2만, 3.4억)
export function formatCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`
  return String(n)
}

// 주식 가격 포맷
export function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원'
}

// 등락률 포맷 (+1.23%, -0.45%)
export function formatChangePct(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

// 카테고리 레이블
export const CATEGORY_LABELS: Record<string, string> = {
  local: '지역',
  stock: '주식',
  housing: '청약',
  free: '자유',
  hot: '핫',
}

// 지역 코드 → 이름
export const REGION_LABELS: Record<string, string> = {
  seoul: '서울',
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  gwangju: '광주',
  daejeon: '대전',
  ulsan: '울산',
  sejong: '세종',
  gyeonggi: '경기',
  gangwon: '강원',
  chungbuk: '충북',
  chungnam: '충남',
  jeonbuk: '전북',
  jeonnam: '전남',
  gyeongbuk: '경북',
  gyeongnam: '경남',
  jeju: '제주',
  national: '전국',
}

// URL 슬러그 생성
export function generateSlug(title: string, id: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)
  return `${slug}-${id}`
}

// 이미지 URL 변환 (Supabase Storage)
export function getStorageUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`
}

// 익명 닉네임 마스킹
export function maskNickname(nickname: string): string {
  if (nickname.length <= 2) return '익명'
  return nickname[0] + '*'.repeat(nickname.length - 2) + nickname[nickname.length - 1]
}

// 등급 색상
export const GRADE_COLORS: Record<number, string> = {
  1: '#9CA3AF',
  2: '#6EE7B7',
  3: '#60A5FA',
  4: '#A78BFA',
  5: '#F59E0B',
  6: '#F97316',
  7: '#EF4444',
  8: '#EC4899',
  9: '#8B5CF6',
  10: '#FF4B36',
}
