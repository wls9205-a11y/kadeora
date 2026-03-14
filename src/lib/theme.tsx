'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface ThemeColors {
  brand: string
  brandLight: string
  brandDark: string
  bg: string
  s1: string
  s2: string
  s3: string
  s4: string
  bull: string
  bear: string
  text: string
  w90: string
  w70: string
  w50: string
  w35: string
  w20: string
  w10: string
  w05: string
  w03: string
}

function makeColors(isDark: boolean): ThemeColors {
  return isDark ? {
    brand: '#FF4B36', brandLight: '#FF6B58', brandDark: '#E8341F',
    bg: '#0A0A0A', s1: '#111111', s2: '#181818', s3: '#222222', s4: '#2C2C2C',
    bull: '#E8341F', bear: '#2563EB', text: '#FFFFFF',
    w90: 'rgba(255,255,255,0.9)', w70: 'rgba(255,255,255,0.7)',
    w50: 'rgba(255,255,255,0.5)', w35: 'rgba(255,255,255,0.35)',
    w20: 'rgba(255,255,255,0.2)', w10: 'rgba(255,255,255,0.1)',
    w05: 'rgba(255,255,255,0.05)', w03: 'rgba(255,255,255,0.03)',
  } : {
    brand: '#FF4B36', brandLight: '#FF6B58', brandDark: '#E8341F',
    bg: '#F2F2F7', s1: '#FFFFFF', s2: '#FAFAFA', s3: '#F0F0F0', s4: '#E5E5EA',
    bull: '#D92D1E', bear: '#1D4ED8', text: '#0A0A0A',
    w90: 'rgba(0,0,0,0.85)', w70: 'rgba(0,0,0,0.65)',
    w50: 'rgba(0,0,0,0.45)', w35: 'rgba(0,0,0,0.30)',
    w20: 'rgba(0,0,0,0.16)', w10: 'rgba(0,0,0,0.08)',
    w05: 'rgba(0,0,0,0.045)', w03: 'rgba(0,0,0,0.028)',
  }
}

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
  C: ThemeColors
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('kadeora-theme')
    if (saved) {
      setIsDark(saved === 'dark')
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('kadeora-theme', isDark ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', isDark)
    }
  }, [isDark, mounted])

  const toggleTheme = () => setIsDark(prev => !prev)
  const C = makeColors(isDark)

  if (!mounted) {
    return <div style={{ background: '#0A0A0A', minHeight: '100vh' }} />
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, C }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
