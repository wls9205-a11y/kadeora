'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function NoticeBanner() {
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('kd_notice_dismissed')) { setDismissed(true); return; }
    const sb = createSupabaseBrowser();
    sb.from('site_notices').select('content').eq('is_active', true)
      .order('id', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setNotice(data[0].content); });
  }, []);

  if (!notice || dismissed) return null;
  return (
    <div style={{
      background: 'var(--brand)', color: '#fff', height: 36,
      display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        whiteSpace: 'nowrap', animation: 'kd-marquee 20s linear infinite',
        fontSize: 13, fontWeight: 500, paddingLeft: '100%',
      }}>
        📢 {notice}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;📢 {notice}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;📢 {notice}
      </div>
      <button onClick={() => { sessionStorage.setItem('kd_notice_dismissed', '1'); setDismissed(true); }}
        style={{ position: 'absolute', right: 12, background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>×</button>
      <style>{`@keyframes kd-marquee { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }`}</style>
    </div>
  );
}
