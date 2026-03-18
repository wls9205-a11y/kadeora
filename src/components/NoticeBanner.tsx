'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function NoticeBanner() {
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('kd_notice_v2')) { setDismissed(true); return; }
    const sb = createSupabaseBrowser();
    sb.from('site_notices').select('content').eq('is_active', true)
      .order('id', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setNotice(data[0].content); });
  }, []);

  if (!notice || dismissed) return null;
  return (
    <div style={{
      background: '#0a1a0a', borderBottom: '1px solid #1a3a1a',
      height: 32, display: 'flex', alignItems: 'center',
      overflow: 'hidden', position: 'relative', zIndex: 52, flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(to right, #0a1a0a, transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 32, top: 0, bottom: 0, width: 40, background: 'linear-gradient(to left, #0a1a0a, transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{
        display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
        animation: 'kd-marquee-v2 25s linear infinite', paddingLeft: '100%',
        fontSize: 12, fontWeight: 600, color: '#4ade80', letterSpacing: '0.03em',
      }}>
        <span>📡&nbsp;{notice}</span>
        <span style={{ margin: '0 60px', color: '#166534', fontSize: 14 }}>◆</span>
        <span>📡&nbsp;{notice}</span>
        <span style={{ margin: '0 60px', color: '#166534', fontSize: 14 }}>◆</span>
        <span>📡&nbsp;{notice}</span>
      </div>
      <button onClick={() => { sessionStorage.setItem('kd_notice_v2', '1'); setDismissed(true); }}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#4ade80', fontSize: 14, cursor: 'pointer', zIndex: 3, opacity: 0.7, padding: '2px 4px' }}>×</button>
      <style>{`@keyframes kd-marquee-v2 { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }`}</style>
    </div>
  );
}
