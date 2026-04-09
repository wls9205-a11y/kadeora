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
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pushAsked, setPushAsked] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const returnUrl = params.get('return') || '/feed';

  const toggle = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleInterests = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      await sb.from('profiles').update({
        interests: selected,
        onboarded: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      trackConversion('cta_complete', 'onboarding_interests', { category: selected.join(',') });
      setStep(2);
    } catch { }
    finally { setSaving(false); }
  };

  const requestPush = async () => {
    try {
      if ('Notification' in window && Notification.permission === 'default' && 'serviceWorker' in navigator) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
          await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
          trackConversion('cta_complete', 'onboarding_push');
        }
      }
    } catch { }
    setPushAsked(true);
  };

  const finish = () => {
    trackConversion('cta_complete', 'onboarding_finish');
    router.replace(returnUrl);
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px, 5vw, 32px)' }}>
        
        {/* 진행 바 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--brand)' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: step >= 2 ? 'var(--brand)' : 'var(--border)' }} />
        </div>

        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              관심 분야를 알려주세요
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
              선택한 분야의 맞춤 알림과 AI 분석을 받을 수 있어요
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
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
            <button onClick={handleInterests} disabled={selected.length === 0 || saving}
              style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
                background: selected.length > 0 ? 'var(--brand)' : 'var(--border)',
                color: selected.length > 0 ? '#fff' : 'var(--text-tertiary)',
                cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
              }}>
              {saving ? '저장 중...' : selected.length === 0 ? '1개 이상 선택해주세요' : `${selected.length}개 선택 완료 →`}
            </button>
            <button onClick={() => { 
              // 스킵 — onboarded만 true로
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
        )}

        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              알림을 받아보세요
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
              관심 종목 급등/급락, 청약 마감 D-7 등을 놓치지 마세요
            </p>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>받게 될 알림 예시</div>
              {[
                { icon: '📈', text: '삼성전자 +3.2% 급등 (52,400원)' },
                { icon: '🏠', text: '래미안 원베일리 청약 마감 D-3' },
                { icon: '📊', text: '주간 AI 투자 분석 리포트' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {!pushAsked ? (
              <button onClick={requestPush}
                style={{
                  width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
                  background: 'var(--brand)', color: '#fff', cursor: 'pointer', marginBottom: 8,
                }}>
                🔔 알림 허용하기
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: 12, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                ✅ 알림 설정 완료!
              </div>
            )}

            <button onClick={finish}
              style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
                background: pushAsked ? 'var(--brand)' : 'none',
                color: pushAsked ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
              {pushAsked ? '카더라 시작하기 🚀' : '나중에 할게요'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}