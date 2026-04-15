'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackConversion } from '@/lib/track-conversion';

const INTERESTS = [
  { key: 'stock', label: '📈 주식', desc: '실시간 시세·AI 분석' },
  { key: 'apt', label: '🏠 청약/부동산', desc: '청약일정·가격 알림' },
  { key: 'redev', label: '🏗️ 재개발', desc: '사업진행·조합현황' },
  { key: 'crypto', label: '₿ 암호화폐', desc: '시세·뉴스' },
  { key: 'news', label: '📰 경제뉴스', desc: '매일 핵심 요약' },
  { key: 'tax', label: '🧾 세금/절세', desc: '절세 팁·세법변경' },
];

const REGIONS = [
  '서울','경기','인천','부산','대구','대전','광주','울산','세종',
  '강원','충북','충남','전북','전남','경북','경남','제주',
];

/* 관심사별 알림 혜택 안내 */
const INTEREST_BENEFITS: Record<string, string> = {
  stock: '관심 종목 목표가 알림',
  apt: '청약 마감·가격 변동 알림',
  redev: '사업 진행 단계 알림',
  news: '주간 시황 리포트',
  tax: '세법 변경 알림',
};

export default function OnboardingClient() {
  const [selected, setSelected] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [marketingAgreed, setMarketingAgreed] = useState(true);
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

  const handleFinish = async (skipRegion = false) => {
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      await sb.from('profiles').update({
        interests: selected.length > 0 ? selected : ['news'],
        residence_city: skipRegion ? null : (region || null),
        region_text: skipRegion ? null : (region || null),
        marketing_agreed: marketingAgreed,
        marketing_agreed_at: marketingAgreed ? new Date().toISOString() : null,
        onboarded: true,
        onboarding_method: 'manual',
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      // 데일리 리포트 자동 연동
      if (region && typeof window !== 'undefined') {
        localStorage.setItem('daily_region', region);
      }
      trackConversion('cta_complete', 'onboarding_interests', { category: selected.join(',') });
      fetch('/api/profile/mission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission: 'interest' }),
      }).catch(() => {});
      // ── 관심 설정 기반 알림 자동 등록 ──
      fetch('/api/onboarding/auto-alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selected, region: region || null }),
      }).catch(() => {});
    } catch {}

    // Android/Desktop: 푸시 구독 시도
    if (!isIOS && 'Notification' in window && Notification.permission === 'default' && 'serviceWorker' in navigator) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });
          await fetch('/api/push/subscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          });
          trackConversion('cta_complete', 'onboarding_push');
        }
      } catch (e) { console.error('[onboarding-push]', e); }
    }

    trackConversion('cta_complete', 'onboarding_finish');
    try { (window as any).gtag?.('event', 'sign_up', { method: 'onboarding' }); } catch {}
    router.replace(returnUrl);
  };

  /* 선택한 관심사 기반 혜택 텍스트 */
  const benefitText = selected.length > 0
    ? selected.slice(0, 2).map(k => INTEREST_BENEFITS[k]).filter(Boolean).join(' · ')
    : '청약 마감·가격 변동 알림';

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: '0 16px' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 'clamp(20px, 5vw, 32px)',
      }}>
        {/* 진행 바 */}
        <div style={{ height: 3, borderRadius: 4, background: 'var(--brand)', marginBottom: 24 }} />

        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          환영합니다! 🎉
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.5 }}>
          관심 분야를 고르면 맞춤 알림을 바로 받을 수 있어요
        </p>

        {/* 관심사 선택 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {INTERESTS.map(({ key, label, desc }) => {
            const sel = selected.includes(key);
            return (
              <button key={key} onClick={() => toggle(key)} style={{
                padding: '12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
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

        {/* 지역 선택 — 선택사항 강조 */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            📍 거주 지역
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 10,
              background: 'rgba(100,116,139,0.15)', color: 'var(--text-tertiary)',
            }}>선택사항</span>
          </label>
          <select value={region} onChange={e => setRegion(e.target.value)} style={{
            width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--border)', background: 'var(--bg-base)',
            color: region ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 14, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
          }}>
            <option value="">선택하세요</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            지역 설정 시 더 정확한 청약·시세 알림을 받을 수 있어요
          </div>
        </div>

        {/* 마케팅 동의 */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
          cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          <input type="checkbox" checked={marketingAgreed} onChange={e => setMarketingAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
          <span>내 지역 청약 마감 알림, 관심 종목 급등/급락, 주간 리포트를 받겠습니다. (선택)</span>
        </label>

        {/* iOS 홈화면 추가 안내 */}
        {isIOS && !isPWA && (
          <div style={{
            background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.15)',
            borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 14,
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontSize: 13 }}>
              📱 앱처럼 사용하기
            </div>
            하단 <strong style={{ color: 'var(--brand)' }}>공유(⬆️)</strong> → <strong style={{ color: 'var(--brand)' }}>&quot;홈 화면에 추가&quot;</strong>하면
            알림도 받고 더 빠르게 이용할 수 있어요!
          </div>
        )}

        <button onClick={() => handleFinish(false)} disabled={saving}
          style={{
            width: '100%', padding: 14, borderRadius: 'var(--radius-card)', border: 'none', fontSize: 15, fontWeight: 800,
            background: 'var(--brand)', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
          {saving ? '시작하는 중...' : '카더라 시작하기 🚀'}
        </button>

        {/* 시작하기 버튼 아래 혜택 요약 */}
        {!saving && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
            가입 즉시 <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{benefitText}</span> 시작
          </div>
        )}

        {/* 건너뛰기 — 기본 관심사 ['news'] 설정 후 온보딩 완료 처리 */}
        <button
          onClick={async () => {
            const sb = createSupabaseBrowser();
            const { data } = await sb.auth.getUser();
            if (data.user) {
              await sb.from('profiles').update({
                onboarded: true,
                onboarding_method: 'skip',
                interests: ['news'],
                updated_at: new Date().toISOString(),
              }).eq('id', data.user.id);
              fetch('/api/onboarding/auto-alerts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interests: ['news'], region: null }),
              }).catch(() => {});
            }
            router.replace(returnUrl);
          }}
          style={{
            width: '100%', marginTop: 10, padding: 8,
            background: 'none', border: 'none',
            fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer',
          }}
        >
          건너뛰기 (나중에 설정)
        </button>
      </div>
    </div>
  );
}
