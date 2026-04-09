'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { REGIONS, SIGUNGU_MAP } from '@/lib/regions';
import Link from 'next/link';
import { getDisplayInterestCount } from '@/lib/interest-utils';

interface Props {
  siteId: string;
  siteName: string;
  interestCount: number;
  slug: string;
  totalSupply?: number | null;
}

export default function InterestRegistration({ siteId, siteName, interestCount, slug, totalSupply }: Props) {
  const { userId, loading } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(getDisplayInterestCount(interestCount, totalSupply));
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [consentCollection, setConsentCollection] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    sb.from('apt_site_interests').select('id')
      .eq('site_id', siteId).eq('user_id', userId).maybeSingle()
      .then(({ data: existing }: any) => { if (existing) setRegistered(true); });
  }, [userId, siteId]);

  const handleMemberRegister = async () => {
    setSubmitting(true); setMessage('');
    try {
      const res = await fetch('/api/apt/sites/interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId }),
      });
      if (res.ok) { setRegistered(false); setCount(c => Math.max(0, c - 1)); setMessage('관심 해제됨'); }
    } catch {}
    setSubmitting(false);
  };

  const handleGuestSubmit = async () => {
    if (!name.trim()) { setMessage('이름을 입력해주세요'); return; }
    if (!phone.match(/^01[016789]\d{7,8}$/)) { setMessage('올바른 전화번호를 입력해주세요'); return; }
    if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setMessage('생년월일을 입력해주세요'); return; }
    if (!city) { setMessage('거주 지역을 선택해주세요'); return; }
    const districts = SIGUNGU_MAP[city] || [];
    if (districts.length > 0 && !district) { setMessage('시/군/구를 선택해주세요'); return; }
    if (!consentCollection) { setMessage('필수 동의 항목에 체크해주세요'); return; }
    const birth = new Date(birthDate);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 14) { setMessage('만 14세 미만은 등록할 수 없습니다'); return; }

    setSubmitting(true); setMessage('');
    try {
      const res = await fetch('/api/apt/sites/interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId, type: 'guest', name: name.trim(), phone,
          birth_date: birthDate, city: city || undefined, district: district || undefined,
          consent_collection: true, consent_marketing: consentMarketing,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCount(c => c + 1); setMessage('관심단지 등록이 완료되었습니다!');
        setName(''); setPhone(''); setBirthDate(''); setCity(''); setDistrict('');
        setConsentCollection(false); setConsentMarketing(false); setShowForm(false);
      } else setMessage(data.error || '등록 실패');
    } catch { setMessage('네트워크 오류'); }
    setSubmitting(false);
  };

  if (loading) return null;

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 3, display: 'block' };

  const FormFields = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>이름 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" style={inp} />
        </div>
        <div>
          <label style={lbl}>전화번호 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} placeholder="01012345678" inputMode="tel" maxLength={11} style={inp} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>생년월일 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={{ ...inp, colorScheme: 'dark' }} />
        </div>
        <div>
          <label style={lbl}>거주 시/도 <span style={{ color: 'var(--error)' }}>*</span></label>
          <select value={city} onChange={e => { setCity(e.target.value); setDistrict(''); }} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">선택</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      {city && (SIGUNGU_MAP[city] || []).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>시/군/구 <span style={{ color: 'var(--error)' }}>*</span></label>
          <select value={district} onChange={e => setDistrict(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">선택</option>
            {(SIGUNGU_MAP[city] || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={consentCollection} onChange={e => setConsentCollection(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 14, height: 14, flexShrink: 0 }} />
          <span><span style={{ color: 'var(--error)', fontWeight: 700 }}>[필수]</span> 개인정보 수집·이용 동의</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={consentMarketing} onChange={e => setConsentMarketing(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 14, height: 14, flexShrink: 0 }} />
          <span>[선택] 마케팅 정보 수신 동의</span>
        </label>
      </div>
      <button onClick={handleGuestSubmit} disabled={submitting || !consentCollection} style={{
        width: '100%', padding: 10, borderRadius: 8, border: 'none',
        background: consentCollection ? 'var(--brand)' : 'var(--bg-hover)',
        color: consentCollection ? '#fff' : 'var(--text-tertiary)',
        fontSize: 13, fontWeight: 700, cursor: consentCollection ? 'pointer' : 'not-allowed',
        opacity: submitting ? 0.5 : 1,
      }}>
        {submitting ? '등록 중...' : userId ? '정보 입력 후 등록' : '관심단지 등록하기'}
      </button>
    </>
  );

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--brand)', borderRadius: 10, padding: '14px 14px 12px', marginBottom: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>❤️ 관심단지 등록</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>{count}명 관심</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['청약일정', '분양가', '입주소식'].map(t => (
            <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontWeight: 600 }}>{t}</span>
          ))}
        </div>
      </div>

      {userId ? (
        <>
          {registered ? (
            <button onClick={handleMemberUnregister} disabled={submitting} style={{
              width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', opacity: submitting ? 0.5 : 1,
            }}>✅ 등록 완료 (탭하여 해제)</button>
          ) : (
            <button onClick={handleMemberRegister} disabled={submitting} style={{
              width: '100%', padding: 10, borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', opacity: submitting ? 0.5 : 1,
            }}>{submitting ? '등록 중...' : '관심단지 등록하기 (+50P)'}</button>
          )}
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{
              width: '100%', padding: 7, marginTop: 6, borderRadius: 6, border: '1px dashed var(--border)',
              background: 'transparent', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
            }}>정보를 직접 입력하려면 탭 →</button>
          ) : (
            <div style={{ marginTop: 8 }}><FormFields /></div>
          )}
        </>
      ) : (
        <>
          <FormFields />
          <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 6, background: 'var(--bg-base)', textAlign: 'center', fontSize: 11 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>회원은 </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>입력없이 원클릭</span>
            <span style={{ color: 'var(--text-tertiary)' }}> + </span>
            <span style={{ fontWeight: 700, color: 'var(--brand)' }}>50P</span>
            <Link href={`/login?redirect=/apt/${slug&source=interest_register}`} style={{ color: 'var(--brand)', fontWeight: 700, marginLeft: 6, textDecoration: 'none' }}>가입→</Link>
          </div>
        </>
      )}

      {message && (
        <p style={{ textAlign: 'center', fontSize: 11, marginTop: 8, marginBottom: 0, color: message.includes('완료') || message.includes('적립') || message.includes('해제') ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
          {message}
        </p>
      )}
    </div>
  );
}
