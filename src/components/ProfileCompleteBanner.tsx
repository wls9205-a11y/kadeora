'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function ProfileCompleteBanner() {
  const [show, setShow] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('kd_profile_banner_dismissed')) return;
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      sb.from('profiles').select('bio, profile_completed').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (p && !p.profile_completed && !p.bio) setShow(true);
        });
    });
  }, []);

  if (!show || !userId) return null;

  return (
    <div style={{
      margin: '0 0 12px', padding: '12px 14px', borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(46,232,165,0.06))',
      border: '1px solid rgba(59,123,246,0.15)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 24 }}>👤</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>프로필을 완성하면 +50P</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>한 줄 소개만 작성하면 완료!</div>
      </div>
      <Link href={`/profile/${userId}`} style={{
        padding: '6px 14px', borderRadius: 8, background: 'var(--brand)', color: '#fff',
        fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>완성하기</Link>
      <button onClick={() => { sessionStorage.setItem('kd_profile_banner_dismissed', '1'); setShow(false); }}
        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer' }}>×</button>
    </div>
  );
}
