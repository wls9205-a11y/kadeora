'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

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

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export default function OnboardingClient() {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { error, success } = useToast();

  const toggleInterest = (key: string) => {
    setSelectedInterests(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : prev.length < 5 ? [...prev, key] : prev
    );
  };

  const handleComplete = async () => {
    if (!nickname.trim()) { error('닉네임을 입력해주세요'); return; }
    if (nickname.trim().length < 2) { error('닉네임은 2자 이상이어야 합니다'); return; }
    if (nickname.trim().length > 20) { error('닉네임은 20자 이하여야 합니다'); return; }
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      // 닉네임 중복 확인
      const { data: existing } = await sb.from('profiles')
        .select('id').eq('nickname', nickname.trim()).neq('id', user.id).maybeSingle();
      if (existing) { error('이미 사용 중인 닉네임입니다'); setSaving(false); return; }

      const { error: updateErr } = await sb.from('profiles').update({
        nickname: nickname.trim(),
        nickname_set: true,
        interests: selectedInterests,
        region_text: region || null,
        marketing_agreed: marketing,
        onboarded: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (updateErr) throw updateErr;
      success('환영합니다! 카더라를 시작해볼까요 🎉');
      router.replace('/feed');
    } catch {
      error('설정 저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const TOTAL_STEPS = 3;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--kd-bg)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
        borderRadius: 20, padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* 진행 바 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--kd-text-dim)' }}>Step {step} / {TOTAL_STEPS}</span>
            <span style={{ fontSize: 12, color: 'var(--kd-primary)', fontWeight: 600 }}>
              {step === 1 ? '닉네임 설정' : step === 2 ? '관심 분야' : '지역 & 마케팅'}
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--kd-border)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--kd-primary)',
              width: `${(step / TOTAL_STEPS) * 100}%`, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Step 1: 닉네임 */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--kd-text)', margin: '0 0 8px' }}>
              안녕하세요! 👋
            </h1>
            <p style={{ fontSize: 14, color: 'var(--kd-text-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>
              카더라에서 사용할 닉네임을 설정해주세요.<br />닉네임은 나중에 프로필에서 변경할 수 있습니다.
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--kd-text-muted)', display: 'block', marginBottom: 8 }}>
              닉네임 <span style={{ color: 'var(--kd-danger)' }}>*</span>
            </label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="2~20자, 한글/영문/숫자"
              maxLength={20}
              className="kd-input"
              style={{ fontSize: 16, marginBottom: 8 }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && nickname.trim().length >= 2 && setStep(2)}
            />
            <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', textAlign: 'right' }}>{nickname.length}/20</div>
            <button
              onClick={() => {
                if (!nickname.trim() || nickname.trim().length < 2) { error('닉네임은 2자 이상이어야 합니다'); return; }
                setStep(2);
              }}
              className="kd-btn kd-btn-primary"
              style={{ width: '100%', marginTop: 24, padding: '13px', fontSize: 15, fontWeight: 700 }}
            >
              다음 →
            </button>
          </div>
        )}

        {/* Step 2: 관심 분야 */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--kd-text)', margin: '0 0 8px' }}>
              관심 분야를 선택해주세요 📊
            </h1>
            <p style={{ fontSize: 14, color: 'var(--kd-text-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
              최대 5개 선택 가능 ({selectedInterests.length}/5)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {INTERESTS.map(({ key, label }) => {
                const selected = selectedInterests.includes(key);
                return (
                  <button key={key} onClick={() => toggleInterest(key)} style={{
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    background: selected ? 'var(--kd-primary-dim)' : 'var(--kd-bg)',
                    border: `1px solid ${selected ? 'var(--kd-primary)' : 'var(--kd-border)'}`,
                    color: selected ? 'var(--kd-primary)' : 'var(--kd-text-muted)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} className="kd-btn kd-btn-ghost" style={{ flex: 1, padding: '13px' }}>← 이전</button>
              <button onClick={() => setStep(3)} className="kd-btn kd-btn-primary" style={{ flex: 2, padding: '13px', fontSize: 15, fontWeight: 700 }}>
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 지역 + 마케팅 */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--kd-text)', margin: '0 0 8px' }}>
              거의 다 됐어요! 🎯
            </h1>
            <p style={{ fontSize: 14, color: 'var(--kd-text-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
              지역 맞춤 청약 정보를 받으려면 거주 지역을 선택해주세요.
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--kd-text-muted)', display: 'block', marginBottom: 8 }}>
              거주 지역 <span style={{ fontSize: 11, fontWeight: 400 }}>(선택)</span>
            </label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 20,
                background: 'var(--kd-surface-2)', border: '1px solid var(--kd-border)',
                color: region ? 'var(--kd-text)' : 'var(--kd-text-dim)',
                fontSize: 14, fontFamily: 'inherit',
              }}
            >
              <option value="">지역 선택 (선택사항)</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              padding: '14px', borderRadius: 10, marginBottom: 24,
              background: marketing ? 'var(--kd-primary-dim)' : 'var(--kd-bg)',
              border: `1px solid ${marketing ? 'var(--kd-primary)' : 'var(--kd-border)'}`,
              transition: 'all 0.15s',
            }}>
              <input
                type="checkbox"
                checked={marketing}
                onChange={e => setMarketing(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--kd-primary)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kd-text)', marginBottom: 2 }}>
                  마케팅 정보 수신 동의 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--kd-text-dim)' }}>(선택)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--kd-text-dim)', lineHeight: 1.5 }}>
                  새 기능, 이벤트, 투자 인사이트 등을 이메일로 받아보세요
                </div>
              </div>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} className="kd-btn kd-btn-ghost" style={{ flex: 1, padding: '13px' }}>← 이전</button>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="kd-btn kd-btn-primary"
                style={{ flex: 2, padding: '13px', fontSize: 15, fontWeight: 700 }}
              >
                {saving ? '저장 중...' : '카더라 시작하기 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}