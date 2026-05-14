import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import LoginClient from './LoginClient';
import InAppBrowserModal from '@/components/InAppBrowserModal';
import { detectInAppBrowserSync } from '@/hooks/useInAppBrowser';

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
      const target = params.redirect;
      const isSafe = typeof target === 'string'
        && target.startsWith('/')
        && !target.startsWith('//')
        && !target.startsWith('/\\')
        && !/^\/[\t\r\n\v\f ]/.test(target);
      redirect(isSafe ? target : '/feed');
    }
  } catch (e: any) {
    if (e?.digest?.includes('NEXT_REDIRECT')) throw e;
  }

  // s268: 서버 사이드 UA 사전 차단 — client useEffect hydration 전 race 차단
  const h = await headers();
  const ua = h.get('user-agent') || '';
  const inApp = detectInAppBrowserSync(ua);
  if (inApp.isInApp && !inApp.canDoOAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
        <InAppBrowserModal type={inApp.type} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
      <Suspense fallback={<div style={{ color: 'var(--text-tertiary)' }}>로딩 중...</div>}>
        <LoginClient />
      </Suspense>
    </div>
  );
}
