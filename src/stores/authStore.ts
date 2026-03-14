import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types/database'

interface AuthState {
  user: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: Profile | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  updateProfile: (updates: Partial<Profile>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false 
      }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () => set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      }),

      updateProfile: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
    }),
    {
      name: 'kadeora-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
