'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackConversion } from '@/lib/track-conversion';

const INTERESTS = [
  { key: 'stock', label: '📈 주식', desc: '실시간 시세·AI 분석' },
  { key: 'apt', label: '🏠 청약/부동산', desc: '청약일정·시세변동' },
  { key: 'redev', label: '🏗️ 재개발', desc: '사업진행·조합현황' },
  { key: 'crypto', label: '₿ 암호화폐', desc: '시세·뉴스' },
  { key: 'news', label: '📰 경제뉴스', desc: '매일 핵심 요약' },
  { key: 'tax', label: '🧾 세금/절세', desc: '절세 팁·세법변경' },
];

export default function OnboardingClient() {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const returnUrl = params.get('return') || '/feed';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsIOS(ios);
    setIsPWA(standalone);
  }, []);

  const toggle = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleFinish = async () => {
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      await sb.from('profiles').update({
        interests: selected.length > 0 ? selected : ['news'],
        onboarded: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      trackConversion('cta_complete', 'onboarding_interests', { category: selected.join(',') });
    } catch {}
    
    // Android/Desktop: 바로 push 시도 (거부해도 OK — SmartPushPrompt가 나중에 재시도)
    if (!isIOS && 'Notification' in window && Notification.permission === 'default' && 'serviceWorker' in navigator) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
          await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
          trackConversion('cta_complete', 'onboarding_push');
        }
      } catch (e) { console.error('[onboarding-push]', e); }
    }

    trackConversion('cta_complete', 'onboarding_finish');
    // GA4 표준 sign_up 이벤트
    try { (window as any).gtag?.('event', 'sign_up', { method: 'onboarding' }); } catch {}
    router.replace(returnUrl);
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px, 5vw, 32px)' }}>
        
        {/* 단일 진행 바 */}
        <div style={{ height: 3, borderRadius: 2, background: 'var(--brand)', marginBottom: 28 }} />

        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          환영합니다! 🎉
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          관심 분야를 선택하면 맞춤 정보를 받을 수 있어요
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {INTERESTS.map(({ key, label, desc }) => {
            const sel = selected.includes(key);
            return (
              <button key={key} onClick={() => toggle(key)} style={{
                padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                background: sel ? 'var(--brand-light)' : 'var(--bg-base)',
                border: `1.5px solid ${sel ? 'var(--brand)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: sel ? 'var(--brand)' : 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{desc}</div>
              </button>
            );
          })}
        </div>

        {/* iOS Safari (비-PWA): 홈 화면 추가 안내 */}
        {isIOS && !isPWA && (
          <div style={{
            background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.15)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 16,
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontSize: 13 }}>
              📱 앱처럼 사용하기
            </div>
            하단 <strong style={{ color: 'var(--brand)' }}>공유(⬆️)</strong> → <strong style={{ color: 'var(--brand)' }}>&quot;홈 화면에 추가&quot;</strong>하면
            알림도 받고 더 빠르게 이용할 수 있어요!
          </div>
        )}

        <button onClick={handleFinish} disabled={saving}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
            background: 'var(--brand)', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
          {saving ? '시작하는 중...' : '카더라 시작하기 🚀'}
        </button>
        
        <button onClick={() => {
          const sb = createSupabaseBrowser();
          sb.auth.getUser().then(({ data }) => {
            if (data.user) sb.from('profiles').update({ onboarded: true }).eq('id', data.user.id);
          });
          router.replace(returnUrl);
        }}
          style={{ width: '100%', marginTop: 8, padding: 10, background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          건너뛰기
        </button>
      </div>
    </div>
  );
}
