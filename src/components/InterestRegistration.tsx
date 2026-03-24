'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { REGIONS, SIGUNGU_MAP } from '@/lib/regions';

interface Props {
  siteId: string;
  siteName: string;
  interestCount: number;
  slug: string;
}

export default function InterestRegistration({ siteId, siteName, interestCount, slug }: Props) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(interestCount);

  // Guest form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentThirdParty, setConsentThirdParty] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      if (data?.user) {
        // Check if already registered
        (sb as any).from('apt_site_interests').select('id')
          .eq('site_id', siteId).eq('user_id', data.user.id).maybeSingle()
          .then(({ data: existing }: any) => { if (existing) setRegistered(true); });
      }
      setLoading(false);
    });
  }, [siteId]);

  const handleMemberRegister = async () => {
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/apt/sites/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, type: 'member' }),
      });
      const data = await res.json();
      if (res.ok) { setRegistered(true); setCount(c => c + 1); setMessage('등록 완료! +50P 적립'); }
      else setMessage(data.error || '등록 실패');
    } catch { setMessage('네트워크 오류'); }
    setSubmitting(false);
  };

  const handleMemberUnregister = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/apt/sites/interest', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId }),
      });
      if (res.ok) { setRegistered(false); setCount(c => Math.max(0, c - 1)); setMessage('관심 해제됨'); }
    } catch {}
    setSubmitting(false);
  };

  const handleGuestSubmit = async () => {
    if (!name.trim()) { setMessage('이름을 입력해주세요'); return; }
    if (!phone.match(/^01[016789]\d{7,8}$/)) { setMessage('올바른 전화번호를 입력해주세요 (하이픈 없이)'); return; }
    if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setMessage('생년월일을 입력해주세요 (YYYY-MM-DD)'); return; }
    if (!consentRequired) { setMessage('필수 동의 항목에 체크해주세요'); return; }

    // 만 14세 체크
    const birth = new Date(birthDate);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 14) { setMessage('만 14세 미만은 등록할 수 없습니다'); return; }

    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/apt/sites/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          type: 'guest',
          name: name.trim(),
          phone,
          birth_date: birthDate,
          city: city || undefined,
          district: district || undefined,
          consent_required: true,
          consent_marketing: consentMarketing,
          consent_third_party: consentThirdParty,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGuestForm(false);
        setCount(c => c + 1);
        setMessage('관심고객 등록이 완료되었습니다!');
      } else {
        setMessage(data.error || '등록 실패');
      }
    } catch { setMessage('네트워크 오류'); }
    setSubmitting(false);
  };

  if (loading) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
    marginBottom: 8,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
  const checkStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '2px solid var(--brand)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>관심고객 등록</div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>{siteName}의 분양 소식을 가장 먼저 받아보세요</p>
      </div>

      {/* 회원: 원클릭 등록/해제 */}
      {user && !showGuestForm && (
        <div style={{ textAlign: 'center' }}>
          {registered ? (
            <button onClick={handleMemberUnregister} disabled={submitting} style={{
              width: '100%', padding: 14, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', opacity: submitting ? 0.5 : 1,
            }}>
              ✅ 등록 완료 (탭하여 해제)
            </button>
          ) : (
            <button onClick={handleMemberRegister} disabled={submitting} style={{
              width: '100%', padding: 14, borderRadius: 10, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', opacity: submitting ? 0.5 : 1,
            }}>
              {submitting ? '등록 중...' : '관심 등록하기 (+50P)'}
            </button>
          )}
        </div>
      )}

      {/* 비회원: 폼 토글 */}
      {!user && !showGuestForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href={`/login?redirect=/apt/sites/${slug}`} style={{
            display: 'block', padding: 14, borderRadius: 10, background: 'var(--brand)',
            color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
          }}>
            로그인하고 등록하기 (+50P)
          </a>
          <button onClick={() => setShowGuestForm(true)} style={{
            padding: 12, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>
            비회원으로 간편 등록
          </button>
        </div>
      )}

      {/* 비회원 등록 폼 */}
      {showGuestForm && (
        <div style={{ marginTop: 8 }}>
          <label style={labelStyle}>이름 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" style={inputStyle} />

          <label style={labelStyle}>전화번호 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} placeholder="01012345678" inputMode="tel" maxLength={11} style={inputStyle} />

          <label style={labelStyle}>생년월일 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>거주 시/도</label>
              <select value={city} onChange={e => { setCity(e.target.value); setDistrict(''); }} style={{ ...inputStyle, marginBottom: 0 }}>
                <option value="">선택</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>시/군/구</label>
              <select value={district} onChange={e => setDistrict(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} disabled={!city}>
                <option value="">선택</option>
                {city && SIGUNGU_MAP[city]?.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* 동의 체크박스 */}
          <div style={{ background: 'var(--bg-base)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <label style={checkStyle}>
              <input type="checkbox" checked={consentRequired} onChange={e => setConsentRequired(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
              <span><span style={{ color: 'var(--error)' }}>[필수]</span> 개인정보 수집·이용 동의 (이름, 전화번호, 생년월일, 거주지역)</span>
            </label>
            <label style={checkStyle}>
              <input type="checkbox" checked={consentMarketing} onChange={e => setConsentMarketing(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
              <span>[선택] 마케팅 정보 수신 동의 (신규 분양 현장 안내)</span>
            </label>
            <label style={checkStyle}>
              <input type="checkbox" checked={consentThirdParty} onChange={e => setConsentThirdParty(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
              <span>[선택] 제3자 제공 동의 (분양 상담사 연결)</span>
            </label>
            <a href="/privacy" target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'underline' }}>개인정보처리방침 전문 보기</a>
          </div>

          <button onClick={handleGuestSubmit} disabled={submitting} style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none',
            background: consentRequired ? 'var(--brand)' : 'var(--bg-hover)',
            color: consentRequired ? '#fff' : 'var(--text-tertiary)',
            fontSize: 14, fontWeight: 700, cursor: consentRequired ? 'pointer' : 'not-allowed',
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? '등록 중...' : '관심고객 등록하기'}
          </button>

          <button onClick={() => setShowGuestForm(false)} style={{
            width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: 'none',
            background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer',
          }}>
            취소
          </button>
        </div>
      )}

      {/* 메시지 */}
      {message && (
        <p style={{ textAlign: 'center', fontSize: 12, marginTop: 8, color: message.includes('완료') || message.includes('적립') ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
          {message}
        </p>
      )}

      {/* 소셜 프루프 */}
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, marginBottom: 0 }}>
        👥 현재 <span style={{ color: 'var(--brand)', fontWeight: 800 }}>{count}</span>명이 관심을 보이고 있어요
      </p>
    </div>
  );
}
