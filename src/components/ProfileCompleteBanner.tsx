'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const DISMISS_KEY = 'kd_profile_banner_dismissed_at';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24시간

export default function ProfileCompleteBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 24시간 쿨다운 체크
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS) return;

    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sb.from('profiles').select('interests, region_text, onboarded, onboarding_method').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (!p) return;
          // 미온보딩, 관심사 없음, 지역 없음, 건너뛰기 유저 모두 대상
          const needsSetup = !p.onboarded
            || !p.interests || p.interests.length === 0
            || (p.interests.length === 1 && p.interests[0] === 'news' && p.onboarding_method === 'skip')
            || !p.region_text;
          if (needsSetup) setShow(true);
        });
    });
  }, []);

  if (!show) return null;

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
      <button onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setShow(false); }}
        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: 4 }}>×</button>
    </div>
  );
}
