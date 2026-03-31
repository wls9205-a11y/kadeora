'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

const TIERS = [
  { id: 'basic', name: 'BASIC', price: 49000, icon: '🏢', color: 'var(--accent-blue)', features: ['카드 골드 하이라이트', '분양중 탭 상단 고정', '상담사 이름·연락처 표시', '월간 노출 리포트'] },
  { id: 'pro', name: 'PRO', price: 149000, icon: '⭐', color: 'var(--accent-yellow)', features: ['BASIC 전체 포함', '이미지 최대 3장 등록', '상담 예약 CTA 버튼', '노출/클릭 상세 리포트', '카카오톡 상담 연동'] },
  { id: 'premium', name: 'PREMIUM', price: 299000, icon: '👑', color: 'var(--accent-purple)', features: ['PRO 전체 포함', '분양중 탭 배너 노출', '관심 유저 푸시 알림', 'AI 분양 분석 리포트', '전담 매니저 지원'] },
];

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export default function ConsultantRegister() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'register' | 'pricing' | 'dashboard'>('register');
  const { info } = useToast();

  // 폼 상태
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kakaoId, setKakaoId] = useState('');
  const [company, setCompany] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [bio, setBio] = useState('');
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
        // 기존 프로필 로드
        const res = await fetch('/api/consultant');
        const d = await res.json();
        if (d.profile) {
          setProfile(d.profile);
          setName(d.profile.name || '');
          setPhone(d.profile.phone || '');
          setKakaoId(d.profile.kakao_id || '');
          setCompany(d.profile.company || '');
          setLicenseNo(d.profile.license_no || '');
          setBio(d.profile.bio || '');
          setRegions(d.profile.regions || []);
          setStep(d.profile.premium_listings?.length > 0 ? 'dashboard' : 'pricing');
        }
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    const res = await fetch('/api/consultant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, kakao_id: kakaoId, company, license_no: licenseNo, bio, regions }),
    });
    const d = await res.json();
    if (d.profile) {
      setProfile(d.profile);
      setStep('pricing');
    }
    setSaving(false);
  };

  const toggleRegion = (r: string) => {
    setRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>로딩 중...</div>;
  if (!user) return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 'var(--sp-lg)' }}>🏢</div>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>분양 상담사 등록</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-2xl)' }}>로그인 후 분양 상담사로 등록하고, 프리미엄 리스팅으로 고객을 만나세요.</p>
      <Link href="/login?redirect=/consultant" style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none', fontWeight: 700, fontSize: 'var(--fs-base)' }}>로그인하기</Link>
    </div>
  );

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' };
  const input = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', boxSizing: 'border-box' as const };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 40px' }}>
      <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-block', marginBottom: 'var(--sp-lg)' }}>← 부동산</Link>

      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-2xl)' }}>
        <div style={{ fontSize: 40, marginBottom: 'var(--sp-sm)' }}>🏢</div>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>분양 상담사</h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: 0 }}>카더라에서 분양 고객을 만나세요</p>
      </div>

      {/* 스텝 인디케이터 */}
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-2xl)', justifyContent: 'center' }}>
        {['등록', '요금제', '대시보드'].map((s, i) => {
          const steps = ['register', 'pricing', 'dashboard'];
          const active = steps.indexOf(step) >= i;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 600, background: active ? 'var(--brand)' : 'var(--bg-hover)', color: active ? 'var(--text-inverse)' : 'var(--text-tertiary)' }}>{i + 1}</div>
              <span style={{ fontSize: 'var(--fs-xs)', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: active ? 600 : 400 }}>{s}</span>
              {i < 2 && <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* Step 1: 등록 */}
      {step === 'register' && (
        <div>
          <div style={card}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-lg)' }}>기본 정보</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', display: 'block' }}>이름 *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', display: 'block' }}>연락처 *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-1234-5678" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', display: 'block' }}>카카오톡 ID</label>
                <input value={kakaoId} onChange={e => setKakaoId(e.target.value)} placeholder="카카오톡 오픈채팅 링크 또는 ID" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', display: 'block' }}>소속 회사</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="○○부동산, ○○공인중개사사무소" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', display: 'block' }}>공인중개사 자격번호</label>
                <input value={licenseNo} onChange={e => setLicenseNo(e.target.value)} placeholder="인증 시 ✅ 마크 부여" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', display: 'block' }}>자기소개 (200자)</label>
                <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 200))} placeholder="경력, 전문 분야, 강점 등을 소개해주세요" rows={3} style={{ ...input, resize: 'none' }} />
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'right' }}>{bio.length}/200</div>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>담당 지역 (복수 선택)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {REGIONS.map(r => (
                <button key={r} onClick={() => toggleRegion(r)} style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${regions.includes(r) ? 'var(--brand)' : 'var(--border)'}`,
                  background: regions.includes(r) ? 'var(--brand)' : 'transparent',
                  color: regions.includes(r) ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                }}>{r}</button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving || !name.trim() || !phone.trim()} style={{
            width: '100%', padding: '14px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: (!name.trim() || !phone.trim()) ? 'var(--bg-hover)' : 'var(--brand)',
            color: (!name.trim() || !phone.trim()) ? 'var(--text-tertiary)' : 'var(--text-inverse)',
            fontSize: 'var(--fs-base)', fontWeight: 700,
          }}>
            {saving ? '저장 중...' : profile ? '프로필 수정' : '상담사 등록'}
          </button>
        </div>
      )}

      {/* Step 2: 요금제 선택 */}
      {step === 'pricing' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-xl)' }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>프리미엄 리스팅 요금제</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>분양중 탭에서 고객에게 직접 노출되세요</div>
          </div>

          {TIERS.map((tier, i) => (
            <div key={tier.id} style={{
              ...card,
              borderColor: i === 1 ? tier.color : 'var(--border)',
              borderWidth: i === 1 ? 2 : 1,
              position: 'relative',
            }}>
              {i === 1 && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 12px', borderRadius: 'var(--radius-md)', background: tier.color, color: 'var(--text-inverse)' }}>인기</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
                <span style={{ fontSize: 'var(--fs-xl)' }}>{tier.icon}</span>
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: tier.color }}>{tier.name}</div>
                  <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>월 {tier.price.toLocaleString()}<span style={{ fontSize: 'var(--fs-sm)', fontWeight: 400, color: 'var(--text-tertiary)' }}>원</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--sp-lg)' }}>
                {tier.features.map(f => (
                  <div key={f} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'flex', gap: 6 }}>
                    <span style={{ color: tier.color }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button onClick={() => {
                // TODO: 토스 결제 연동 후 활성화
                info(`${tier.name} 요금제 결제 기능은 곧 오픈됩니다. 문의: kadeora.app@gmail.com`);
              }} style={{
                width: '100%', padding: '10px 0', borderRadius: 'var(--radius-sm)', border: `1px solid ${tier.color}`, cursor: 'pointer',
                background: i === 1 ? tier.color : 'transparent',
                color: i === 1 ? 'var(--text-inverse)' : tier.color,
                fontSize: 'var(--fs-sm)', fontWeight: 700,
              }}>
                {tier.name} 시작하기
              </button>
            </div>
          ))}

          <div style={{ textAlign: 'center', marginTop: 'var(--sp-lg)' }}>
            <button onClick={() => setStep('register')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>← 프로필 수정</button>
          </div>

          <div style={{ ...card, marginTop: 'var(--sp-lg)', background: 'rgba(96,165,250,0.06)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 'var(--sp-sm)' }}>💡 왜 프리미엄 리스팅인가요?</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              분양 상담 1건 계약 시 수백~수천만 원의 수수료가 발생합니다.<br/>
              월 4.9만~29.9만 원으로 카더라의 분양 관심 유저에게 직접 노출되어,<br/>
              단 1건의 상담만 성사되어도 ROI가 수십 배입니다.
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 대시보드 */}
      {step === 'dashboard' && profile && (
        <div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>내 프로필</div>
              <button onClick={() => setStep('register')} style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>수정</button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-md)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-inverse)', fontWeight: 800, fontSize: 'var(--fs-lg)' }}>
                {name.slice(0, 1)}
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{name} {profile.is_verified && '✅'}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{company || '소속 미입력'} · {phone}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{regions.join(', ') || '지역 미설정'}</div>
              </div>
            </div>
          </div>

          {/* 리스팅 현황 */}
          <div style={card}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>📊 내 리스팅</div>
            {profile.premium_listings?.length > 0 ? profile.premium_listings.map((l: any) => (
              <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: l.tier === 'premium' ? 'var(--accent-purple-bg)' : l.tier === 'pro' ? 'var(--accent-yellow-bg)' : 'var(--accent-blue-bg)', color: l.tier === 'premium' ? 'var(--accent-purple)' : l.tier === 'pro' ? 'var(--accent-yellow)' : 'var(--accent-blue)' }}>{l.tier.toUpperCase()}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginLeft: 8 }}>{l.house_nm || '현장명'}</span>
                  </div>
                  <span style={{ fontSize: 'var(--fs-xs)', color: l.is_active ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>{l.is_active ? '활성' : '만료'}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-lg)', marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <span>👀 노출 {(l.impressions || 0).toLocaleString()}</span>
                  <span>👆 클릭 {(l.clicks || 0).toLocaleString()}</span>
                  <span>📞 CTA {(l.cta_clicks || 0).toLocaleString()}</span>
                  <span>CTR {l.impressions > 0 ? ((l.clicks / l.impressions) * 100).toFixed(1) : '0.0'}%</span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
                  만료: {new Date(l.expires_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-sm)' }}>아직 활성 리스팅이 없어요</div>
                <button onClick={() => setStep('pricing')} style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand)', background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer' }}>프리미엄 리스팅 시작</button>
              </div>
            )}
          </div>

          <button onClick={() => setStep('pricing')} style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand)', background: 'transparent', color: 'var(--brand)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer' }}>
            + 새 리스팅 추가
          </button>
        </div>
      )}
    </div>
  );
}
