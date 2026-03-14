'use client'

import { useTheme } from '@/lib/theme'

interface IconProps {
  size?: number
  active?: boolean
  filled?: boolean
  color?: string
}

export function HomeIcon({ size = 22, active }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? C.brand : 'none'} stroke={active ? C.brand : C.w35} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

export function StockIcon({ size = 22, active }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.w35} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}

export function HouseIcon({ size = 22, active }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.w35} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/>
      <path d="M5 21V7l8-4 8 4v14"/>
      <path d="M9 21v-4h4v4"/>
    </svg>
  )
}

export function ChatIcon({ size = 22, active }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? C.brand + '20' : 'none'} stroke={active ? C.brand : C.w35} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

export function UserIcon({ size = 22, active }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.w35} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export function SearchIcon({ size = 18 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w50} strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

export function BellIcon({ size = 18 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w50} strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  )
}

export function WriteIcon({ size = 18, color }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.w50} strokeWidth="2">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>
    </svg>
  )
}

export function BackIcon({ size = 22 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w70} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

export function HeartIcon({ size = 15, filled }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? C.brand : 'none'} stroke={filled ? C.brand : C.w35} strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

export function CommentIcon({ size = 15 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w35} strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

export function EyeIcon({ size = 14 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w35} strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

export function SendIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  )
}

export function ShareIcon({ size = 16 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w50} strokeWidth="2">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

export function BookmarkIcon({ size = 16, filled }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#FBBF24' : 'none'} stroke={filled ? '#FBBF24' : C.w35} strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
  )
}

export function CloseIcon({ size = 20 }: IconProps) {
  const { C } = useTheme()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.w50} strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

export function FireIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F97316" stroke="none">
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.19 2.13-6.17 4-8l1.24 2.48A6 6 0 0112 4a6 6 0 013.76 5.48L17 7c1.87 1.83 4 4.81 4 8 0 4.42-4.03 8-9 8z"/>
    </svg>
  )
}
