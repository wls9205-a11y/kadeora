import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '내 프로필',
  description: '카더라 프로필 — 활동 내역, 포인트, 등급을 확인하세요.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
