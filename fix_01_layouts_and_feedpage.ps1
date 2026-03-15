# ============================================================
# KADEORA 수정 스크립트 1/3
# 실행: C:\Users\82105\Documents\kadeora 에서 PowerShell로 실행
# ============================================================

Set-Location "C:\Users\82105\Documents\kadeora"
$enc = [System.Text.UTF8Encoding]::new($false)

# ── 1. src/app/layout.tsx — 한글 metadata 복원 ──────────────
$f1 = 'src\app\layout.tsx'
$c1 = @'
import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '카더라 - 대한민국 No.1 커뮤니티 플랫폼',
  description: '주식, 부동산, 청약, 자유게시판 — 카더라에서 소통하세요',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kadeora.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
'@
[System.IO.File]::WriteAllText("$PWD\$f1", $c1, $enc)
Write-Host "✅ 1/3 완료: $f1"

# ── 2. src/app/(main)/layout.tsx — 한글 metadata + kw.heat_score 유지 ──
$f2 = 'src\app\(main)\layout.tsx'
$c2 = @'
import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/Toast';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: { template: '%s | 카더라', default: '카더라' },
  description: '주식, 부동산, 청약, 자유게시판 — 카더라에서 소통하세요',
  keywords: ['카더라', '커뮤니티', '주식', '부동산', '청약', '토론'],
  openGraph: {
    siteName: '카더라',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Navigation />
      <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50 }}>
        <ThemeToggle />
      </div>
      <main style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '20px 16px 90px',
        minHeight: 'calc(100vh - 60px)',
      }}>
        {children}
      </main>
    </ToastProvider>
  );
}
'@
[System.IO.File]::WriteAllText("$PWD\$f2", $c2, $enc)
Write-Host "✅ 2/3 완료: $f2"

# ── 3. src/app/(main)/feed/page.tsx — .order('rank') → .order('heat_score') 수정 ──
$f3 = 'src\app\(main)\feed\page.tsx'
$c3 = @'
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { unstable_cache } from 'next/cache';
import { DEMO_POSTS, DEMO_TRENDING } from '@/lib/constants';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import FeedClient from './FeedClient';

const getPosts = unstable_cache(async (category: string) => {
  const sb = await createSupabaseServer();
  let q = sb.from('posts')
    .select('*, profiles(id,nickname,avatar_url,grade)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(30);
  if (category !== 'all') q = q.eq('category', category);
  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;
  return data as PostWithProfile[];
}, ['posts'], { revalidate: 60 });

const getTrending = unstable_cache(async () => {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('trending_keywords')
    .select('*')
    .order('heat_score', { ascending: false })
    .limit(10);
  return data as TrendingKeyword[] | null;
}, ['trending'], { revalidate: 300 });

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function FeedPage({ searchParams }: Props) {
  const { category = 'all' } = await searchParams;

  const [postsData, trendingData] = await Promise.allSettled([
    getPosts(category),
    getTrending(),
  ]);

  const posts =
    postsData.status === 'fulfilled' && postsData.value
      ? postsData.value
      : category === 'all'
      ? DEMO_POSTS
      : DEMO_POSTS.filter((p) => p.category === category);

  const trending =
    trendingData.status === 'fulfilled' && trendingData.value
      ? trendingData.value
      : DEMO_TRENDING;

  const isDemo = postsData.status === 'rejected' || !postsData.value;

  return (
    <Suspense>
      <FeedClient
        posts={posts}
        trending={trending}
        activeCategory={category}
        isDemo={isDemo}
      />
    </Suspense>
  );
}
'@
[System.IO.File]::WriteAllText("$PWD\$f3", $c3, $enc)
Write-Host "✅ 3/3 완료: $f3"

Write-Host ""
Write-Host "🎉 스크립트 1/3 완료! 다음 스크립트(FeedClient.tsx)를 실행하세요."
