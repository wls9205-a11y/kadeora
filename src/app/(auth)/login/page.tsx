import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: '로그인 | 카더라',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const params = await searchParams;
    redirect(params.redirect ?? '/feed');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--kd-bg)', padding: 20 }}>
      <Suspense fallback={<div style={{ color: '#94A3B8' }}>로딩 중...</div>}>
        <LoginClient />
      </Suspense>
    </div>
  );
}