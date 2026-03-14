'use client'

import { useTheme } from '@/lib/theme'
import { getGradeColor } from '@/lib/utils'
import { ReactNode, ButtonHTMLAttributes } from 'react'

// 로고 컴포넌트
export function Logo({ size = 30 }: { size?: number }) {
  const { C } = useTheme()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${C.brand}, #FF8C00)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        boxShadow: `0 2px 10px ${C.brand}40`,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      🐵
    </div>
  )
}

// 배지 컴포넌트
interface BadgeProps {
  children: ReactNode
  color?: string
  bg?: string
}

export function Badge({ children, color, bg }: BadgeProps) {
  const { C } = useTheme()
  const badgeColor = color || C.brand
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: badgeColor,
        background: bg || `${badgeColor}15`,
        padding: '2px 8px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// 아바타 컴포넌트
interface AvatarProps {
  name?: string
  grade?: number
  size?: number
  isAnon?: boolean
}

export function Avatar({ name, grade = 1, size = 20, isAnon }: AvatarProps) {
  const color = isAnon ? '#6B7280' : getGradeColor(grade)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `${color}20`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {isAnon ? '?' : (name || '?')[0]}
    </div>
  )
}

// 버튼 컴포넌트
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
  small?: boolean
  full?: boolean
  children: ReactNode
}

export function Button({ 
  children, 
  primary, 
  small, 
  full, 
  disabled,
  style,
  ...props 
}: ButtonProps) {
  const { C } = useTheme()
  return (
    <button
      disabled={disabled}
      style={{
        height: small ? 34 : 46,
        padding: small ? '0 14px' : '0 20px',
        borderRadius: small ? 10 : 14,
        border: primary ? 'none' : `1px solid ${C.w10}`,
        background: primary ? C.brand : 'rgba(255,255,255,0.05)',
        color: primary ? 'white' : C.w70,
        fontSize: small ? 13 : 15,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        width: full ? '100%' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

// 스피너 컴포넌트
interface SpinnerProps {
  size?: number
  color?: string
}

export function Spinner({ size = 18, color = 'white' }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}30`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  )
}

// 빈 상태 컴포넌트
interface EmptyStateProps {
  emoji: string
  text: string
}

export function EmptyState({ emoji, text }: EmptyStateProps) {
  const { C } = useTheme()
  return (
    <div className="fade-in" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 36, marginBottom: 10 }}>{emoji}</p>
      <p style={{ fontSize: 14, color: C.w35 }}>{text}</p>
    </div>
  )
}

// 스켈레톤 로더
interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: number
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8 }: SkeletonProps) {
  const { C } = useTheme()
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: `linear-gradient(90deg, ${C.w05} 25%, ${C.w10} 50%, ${C.w05} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}
