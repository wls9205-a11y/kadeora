'use client';
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface UserProfile {
  nickname: string | null;
  avatarUrl: string | null;
  grade: number;
  points: number;
  fontSizePref: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  regionText: string | null;
}

interface AuthState {
  userId: string | null;
  loading: boolean;
  profile: UserProfile | null;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthState>({ userId: null, loading: true, profile: null, refreshProfile: () => {} });

export function AuthProvider({ children, serverLoggedIn }: { children: React.ReactNode; serverLoggedIn: boolean }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const sb = createSupabaseBrowser();
      const { data } = await sb.from('profiles').select('nickname, avatar_url, grade, points, font_size_preference, is_admin, is_premium, premium_expires_at, region_text').eq('id', uid).single();
      if (data) {
        const now = new Date();
        const expiresAt = data.premium_expires_at ? new Date(data.premium_expires_at) : null;
        const isPremium = !!(data.is_premium && expiresAt && expiresAt > now);
        setProfile({
          nickname: data.nickname,
          avatarUrl: data.avatar_url,
          grade: data.grade ?? 1,
          points: data.points ?? 0,
          fontSizePref: data.font_size_preference,
          isAdmin: data.is_admin ?? false,
          isPremium,
          premiumExpiresAt: data.premium_expires_at,
          regionText: data.region_text,
        });
      }
    } catch { /* silent */ }
  }, []);

  const refreshProfile = useCallback(() => {
    if (userId) fetchProfile(userId);
  }, [userId, fetchProfile]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setLoading(false);
      if (uid) fetchProfile(uid);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) fetchProfile(uid);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const value = useMemo(() => ({ userId, loading, profile, refreshProfile }), [userId, loading, profile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
