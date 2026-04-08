import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '🎛️ Mission Control | 카더라',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', position: 'relative' }}>
      {children}
    </div>
  );
}
