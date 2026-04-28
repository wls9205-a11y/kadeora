'use client';
import dynamic from 'next/dynamic';

// s187 fix: { ssr: false } 7개 모두 제거 — 각 ssr:false 가 SSR Suspense bailout 을 만들어
// blog/[slug] 의 notFound() 가 서버에서 HTTP 404 로 전파되지 못하고 200 OK 로 떨어졌음
// (BAILOUT_TO_CLIENT_SIDE_RENDERING 7개 = 이 7개 ssr:false 와 1:1 매칭).
// 모든 컴포넌트는 'use client' 이며 브라우저 API 는 useEffect 안에서만 호출 → SSR 안전.
// SSR 시에는 초기 state (보통 빈/숨김) 가 렌더되고, 클라이언트에서 hydrate.
//
// s202 fix: Sidebar / RightPanel 만 { ssr: false } 재도입 — production 에서 React #310
// (Hook order) + #300 (Invalid element) 발생. 두 컴포넌트는 usePathname + useSearchParams
// + useAuth + 다중 useEffect 를 가진 hook-heavy 컴포넌트라 SSR/hydrate hook 순서 mismatch
// 위험 큼. blog/[slug] notFound() 는 페이지 자체에서 직접 throw 하는 경로가 별도 fix 됨
// (s187 후속). 나머지 5개 (InstallBanner/PWAInstallTracker/NoticeBanner/PageView/Behavior)
// 는 hook-light 라 SSR 유지.
export const Sidebar     = dynamic(() => import('@/components/Sidebar'),    { ssr: false });
export const RightPanel  = dynamic(() => import('@/components/RightPanel'), { ssr: false });
export const InstallBanner     = dynamic(() => import('@/components/InstallBanner'));
export const PWAInstallTracker = dynamic(() => import('@/components/PWAInstallTracker'));
export const NoticeBanner      = dynamic(() => import('@/components/NoticeBanner'));
export const PageViewTracker   = dynamic(() => import('@/components/PageViewTracker'));
export const BehaviorTracker   = dynamic(() => import('@/components/BehaviorTracker'));
