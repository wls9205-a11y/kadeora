'use client';
import dynamic from 'next/dynamic';

export const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });
export const RightPanel = dynamic(() => import('@/components/RightPanel'), { ssr: false });
export const InstallBanner = dynamic(() => import('@/components/InstallBanner'), { ssr: false });
export const PWAInstallTracker = dynamic(() => import('@/components/PWAInstallTracker'), { ssr: false });
export const NoticeBanner = dynamic(() => import('@/components/NoticeBanner'), { ssr: false });
export const GuestCTA = dynamic(() => import('@/components/GuestCTA'), { ssr: false });
export const PageViewTracker = dynamic(() => import('@/components/PageViewTracker'), { ssr: false });
