import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: '로그인',
  robots: { index: false, follow: false },
  openGraph: {
    title: '카더라 시작하기',
    images: [{ url: SITE_URL + '/images/brand/kadeora-features.png', alt: '카더라 시작하기' }],
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const cookieStore = await cookies();
  const safeCookies = () => { try { return cookieStore.getAll(); } catch { return []; } };
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: safeCookies } }
  );
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const params = await searchParams;
      redirect(params.redirect ?? '/feed');
    }
  } catch (e: any) {
    // redirect() throws NEXT_REDIRECT — must re-throw
    if (e?.digest?.includes('NEXT_REDIRECT')) throw e;
    // Other errors (cookie parse, network) — render login page
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
      <Suspense fallback={<div style={{ color: 'var(--text-tertiary)' }}>로딩 중...</div>}>
        <LoginClient />
      </Suspense>
    </div>
  );
}