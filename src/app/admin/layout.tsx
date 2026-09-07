import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '🎛️ Mission Control',
  robots: { index: false, follow: false },
};

// ⛔ AD-5(2026-09-07) — maximumScale: 1 을 5 로 올리고 userScalable 을 켠다.
//    어드민은 표·수치를 들여다보는 화면인데 확대를 막고 있었다. 루트 layout 은
//    이미 5 · userScalable: true 였으니 여기만 «더 조이고» 있었던 셈이다.
//    (WCAG 1.4.4 — 확대 차단은 저시력 사용자에게 그대로 장벽이 된다)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', position: 'relative' }}>
      {children}
    </div>
  );
}
