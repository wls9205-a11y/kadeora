'use client';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface AuthState {
  userId: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ userId: null, loading: true });

export function AuthProvider({ children, serverLoggedIn }: { children: React.ReactNode; serverLoggedIn: boolean }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ userId, loading }), [userId, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
