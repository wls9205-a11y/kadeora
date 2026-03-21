'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { validateNickname } from '@/lib/nickname-filter';

const INTERESTS = [
  { key: 'stock',   label: '📈 주식' },
  { key: 'apt',     label: '🏠 청약/부동산' },
  { key: 'crypto',  label: '🪙 코인' },
  { key: 'fund',    label: '💼 펀드/ETF' },
  { key: 'saving',  label: '💰 저축/예금' },
  { key: 'tax',     label: '🧾 세금/절세' },
  { key: 'side',    label: '🛠 부업/재테크' },
  { key: 'news',    label: '📰 경제뉴스' },
];

const REGIONS = ['서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];

const AGE_GROUPS = [
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s', label: '50대' },
  { value: '60+', label: '60대 이상' },
];

export default function OnboardingClient() {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { error, success } = useToast();

  const toggleInterest = (key: string) =>
    setSelectedInterests(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : prev.length < 5 ? [...prev, key] : prev
    );

  const handleComplete = async () => {
    const nickValidation = validateNickname(nickname);
    if (!nickValidation.valid) { error(nickValidation.error!); return; }
    if (!region) { error('지역을 선택해주세요'); return; }
    if (!ageGroup) { error('연령대를 선택해주세요'); return; }
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: existing } = await sb.from('profiles').select('id').eq('nickname', nickname.trim()).neq('id', user.id).maybeSingle();
      if (existing) { error('이미 사용 중인 닉네임입니다'); setSaving(false); return; }
      const fontPref = (ageGroup === '50s' || ageGroup === '60+') ? 'large' : 'medium';
      const { error: updateErr } = await sb.from('profiles').update({
        nickname: nickname.trim(), nickname_set: true,
        interests: selectedInterests, region_text: region || null,
        age_group: ageGroup, font_size_preference: fontPref,
        marketing_agreed: marketing, onboarded: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (updateErr) throw updateErr;
      // Sync font size to localStorage and DOM
      localStorage.setItem('kd_font_size', fontPref);
      document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
      document.documentElement.classList.add(`font-${fontPref}`);
      success('환영합니다! 카더라를 시작해볼까요 🎉');
      try {
        if ('Notification' in window && Notification.permission === 'default' && 'serviceWorker' in navigator) {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
            await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
          }
        }
      } catch {}
      router.replace('/feed');
    } catch { error('설정 저장 중 오류가 발생했습니다'); }
    finally { setSaving(false); }
  };

  const TOTAL = 4;
  const stepLabels = ['닉네임 설정', '관심 분야', '연령대', '지역 & 마케팅'];

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 36px' }}>
        {/* 진행 바 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Step {step} / {TOTAL}</span>
            <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>{stepLabels[step - 1]}</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'var(--brand)', width: `${(step / TOTAL) * 100}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Step 1: 닉네임 */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>안녕하세요! 👋</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.6 }}>
              카더라에서 사용할 닉네임을 설정해주세요.<br />닉네임은 나중에 프로필에서 변경할 수 있습니다.
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              닉네임 <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="2~20자" maxLength={20}
              className="kd-input" style={{ fontSize: 16, marginBottom: 8 }} autoFocus
              onKeyDown={e => e.key === 'Enter' && nickname.trim().length >= 2 && setStep(2)} />
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>{nickname.length}/20</div>
            <button onClick={() => { const v = validateNickname(nickname); if (!v.valid) { error(v.error!); return; } setStep(2); }}
              className="kd-btn kd-btn-primary" style={{ width: '100%', marginTop: 24, padding: '13px', fontSize: 15, fontWeight: 700 }}>
              다음 →
            </button>
          </div>
        )}

        {/* Step 2: 관심 분야 */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>관심 분야를 선택해주세요 📊</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>최대 5개 선택 ({selectedInterests.length}/5)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {INTERESTS.map(({ key, label }) => {
                const sel = selectedInterests.includes(key);
                return (
                  <button key={key} onClick={() => toggleInterest(key)} style={{
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    background: sel ? 'var(--brand-light)' : 'var(--bg-base)',
                    border: `1px solid ${sel ? 'var(--brand)' : 'var(--border)'}`,
                    color: sel ? 'var(--brand)' : 'var(--text-secondary)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>{label}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} className="kd-btn kd-btn-ghost" style={{ flex: 1, padding: '13px' }}>← 이전</button>
              <button onClick={() => setStep(3)} className="kd-btn kd-btn-primary" style={{ flex: 2, padding: '13px', fontSize: 15, fontWeight: 700 }}>다음 →</button>
            </div>
          </div>
        )}

        {/* Step 3: 연령대 */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>연령대를 알려주세요 🎂</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
              맞춤 콘텐츠와 화면 설정에 활용됩니다.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {AGE_GROUPS.map(({ value, label }) => {
                const sel = ageGroup === value;
                return (
                  <button key={value} onClick={() => setAgeGroup(value)} style={{
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 600,
                    background: sel ? 'var(--brand-light)' : 'var(--bg-base)',
                    border: `1px solid ${sel ? 'var(--brand)' : 'var(--border)'}`,
                    color: sel ? 'var(--brand)' : 'var(--text-secondary)',
                    transition: 'all 0.15s', textAlign: 'center',
                  }}>{label}</button>
                );
              })}
            </div>
            {(ageGroup === '50s' || ageGroup === '60+') && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                💡 글씨 크기가 &apos;크게&apos;로 자동 설정됩니다. 나중에 설정에서 변경할 수 있어요.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} className="kd-btn kd-btn-ghost" style={{ flex: 1, padding: '13px' }}>← 이전</button>
              <button onClick={() => ageGroup ? setStep(4) : error('연령대를 선택해주세요')} className="kd-btn kd-btn-primary" style={{ flex: 2, padding: '13px', fontSize: 15, fontWeight: 700 }}>다음 →</button>
            </div>
          </div>
        )}

        {/* Step 4: 지역 + 마케팅 */}
        {step === 4 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>거의 다 됐어요! 🎯</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>지역 맞춤 청약 정보를 받으려면 거주 지역을 선택해주세요.</p>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              거주 지역 <span style={{ color: 'var(--error)' }}>*</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--error)', color: 'var(--text-inverse)', marginLeft: 6, fontWeight: 700 }}>필수</span>
            </label>
            {!region && (
              <div style={{ fontSize: 11, color: 'var(--brand)', marginBottom: 6 }}>
                📍 지역을 선택해야 맞춤 피드를 받을 수 있어요
              </div>
            )}
            <select value={region} onChange={e => setRegion(e.target.value)} style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 20,
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: region ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 14, fontFamily: 'inherit',
            }}>
              <option value="">지역을 선택해주세요</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '14px',
              borderRadius: 10, marginBottom: 24,
              background: marketing ? 'var(--brand-light)' : 'var(--bg-base)',
              border: `1px solid ${marketing ? 'var(--brand)' : 'var(--border)'}`, transition: 'all 0.15s',
            }}>
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--brand)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  마케팅 정보 수신 동의 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>(선택)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>새 기능, 이벤트, 투자 인사이트 등을 이메일로 받아보세요</div>
              </div>
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' as const }}>
              🔔 버튼을 누르면 알림 허용 여부를 물어봐요. 허용하면 새 소식을 바로 받을 수 있어요!
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} className="kd-btn kd-btn-ghost" style={{ flex: 1, padding: '13px' }}>← 이전</button>
              <button onClick={handleComplete} disabled={saving || !region}
                style={{ flex: 2, padding: '16px', fontSize: 16, fontWeight: 800, border: 'none', borderRadius: 12, cursor: (saving || !region) ? 'not-allowed' : 'pointer', color: 'var(--text-inverse)', background: 'linear-gradient(135deg, #FF4500, #FF6B35)', boxShadow: '0 4px 16px rgba(255,69,0,0.3)', opacity: (saving || !region) ? 0.5 : 1 }}>
                {saving ? '저장 중...' : !region ? '지역을 선택해주세요' : '카더라 시작하기 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}