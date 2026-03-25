import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🎛️ Mission Control | 카더라',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
