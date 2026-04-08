import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🎛️ Mission Control | 카더라',
  robots: { index: false, follow: false },
  viewport: { width: 'device-width', initialScale: 1, maximumScale: 1 },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div style={{width:'100vw',maxWidth:'100vw',overflowX:'hidden'}}>{children}</div>;
}
