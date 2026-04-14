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
      sb.from('profiles').select('interests, region_text, onboarded').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          // 관심 설정이 비어있거나 온보딩 미완료 시 표시
          if (p && (!p.interests || p.interests.length === 0 || !p.region_text)) setShow(true);
        });
    });
  }, []);

  if (!show || !userId) return null;

  return (
    <div style={{
      margin: '0 0 12px', padding: '12px 14px', borderRadius: 'var(--radius-card)',
      background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(46,232,165,0.06))',
      border: '1px solid rgba(59,123,246,0.15)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 24 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>관심 지역·종목을 설정하면 맞춤 알림을 받을 수 있어요</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>10초면 설정 완료! 시세 변동, 청약 마감 알림을 무료로</div>
      </div>
      <Link href="/onboarding" style={{
        padding: '6px 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: '#fff',
        fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>설정하기</Link>
      <button onClick={() => { sessionStorage.setItem('kd_profile_banner_dismissed', '1'); setShow(false); }}
        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer' }}>×</button>
    </div>
  );
}
