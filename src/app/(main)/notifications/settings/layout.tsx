import type { Metadata } from 'next';
export const metadata: Metadata = { title: '알림 설정', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
