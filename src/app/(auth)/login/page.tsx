import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--kd-bg)', padding: 20 }}>
      <Suspense fallback={<div style={{ color: '#94A3B8' }}>로딩 중...</div>}>
        <LoginClient />
      </Suspense>
    </div>
  );
}
