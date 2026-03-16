'use client';
import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="alert" aria-live="assertive" style={{
      position:'fixed', top:0, left:0, right:0, zIndex:9999,
      backgroundColor:'var(--warning)', color:'var(--text-primary)',
      textAlign:'center', padding:'8px 16px', fontSize:14, fontWeight:600
    }}>
      📡 인터넷 연결이 끊겼습니다. 연결을 확인해주세요.
    </div>
  );
}
