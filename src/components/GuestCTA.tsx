'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function GuestCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const exp = localStorage.getItem('kd_guest_cta');
    if (exp && Date.now() < parseInt(exp)) return;
    createSupabaseBrowser().auth.getUser().then(({ data }) => {
      if (!data.user) setShow(true);
    });
  }, []);

  if (!show) return null;
  return (
    <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 100, padding: '0 16px' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--brand)', borderRadius: 16,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>댓글·좋아요·알림 받고 싶다면?</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>카더라 회원이 되면 더 많은 기능을 쓸 수 있어요</div>
        </div>
        <Link href="/login" style={{
          background: 'var(--brand)', color: 'var(--text-inverse)', padding: '8px 16px', borderRadius: 10,
          fontSize: 'var(--fs-sm)', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>1초 가입</Link>
        <button onClick={() => { setShow(false); localStorage.setItem('kd_guest_cta', String(Date.now() + 24 * 60 * 60 * 1000)); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-lg)', cursor: 'pointer', padding: 4 }} aria-label="닫기">×</button>
      </div>
    </div>
  );
}
