'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { REGIONS, SIGUNGU_MAP } from '@/lib/regions';
import Link from 'next/link';

interface Props {
  siteId: string;
  siteName: string;
  interestCount: number;
  slug: string;
}

export default function InterestRegistration({ siteId, siteName, interestCount, slug }: Props) {
  const { userId, loading } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(interestCount);

  // Guest form state
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
    if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setMessage('생년월일을 입력해주세요'); return; }
    if (!city) { setMessage('거주 지역을 선택해주세요'); return; }
    const districts = SIGUNGU_MAP[city] || [];
    if (districts.length > 0 && !district) { setMessage('시/군/구를 선택해주세요'); return; }
    if (!consentCollection) { setMessage('필수 동의 항목에 체크해주세요'); return; }

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
          consent_collection: true,
          consent_marketing: consentMarketing,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCount(c => c + 1);
        setMessage('관심단지 등록이 완료되었습니다!');
        setName(''); setPhone(''); setBirthDate(''); setCity(''); setDistrict('');
        setConsentCollection(false); setConsentMarketing(false);
      } else {
        setMessage(data.error || '등록 실패');
      }
    } catch { setMessage('네트워크 오류'); }
    setSubmitting(false);
  };

  if (loading) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)',
    fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-xs)',
  };

  const GuestForm = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)' }}>
        <div>
          <label style={labelStyle}>이름 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>전화번호 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} placeholder="01012345678" inputMode="tel" maxLength={11} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)' }}>
        <div>
          <label style={labelStyle}>생년월일 <span style={{ color: 'var(--error)' }}>*</span></label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>거주 지역 <span style={{ color: 'var(--error)' }}>*</span></label>
          <select value={city} onChange={e => { setCity(e.target.value); setDistrict(''); }} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">시/도 선택</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      {city && (SIGUNGU_MAP[city] || []).length > 0 && (
        <div style={{ marginBottom: 'var(--sp-sm)' }}>
          <label style={labelStyle}>시/군/구 <span style={{ color: 'var(--error)' }}>*</span></label>
          <select value={district} onChange={e => setDistrict(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">시/군/구 선택</option>
            {(SIGUNGU_MAP[city] || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* 동의 */}
      <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: 10, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-sm)', marginBottom: 6, cursor: 'pointer', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <input type="checkbox" checked={consentCollection} onChange={e => setConsentCollection(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
          <span><span style={{ color: 'var(--error)' }}>[필수]</span> 개인정보 수집·이용 동의 (이름, 전화번호, 생년월일, 거주지역)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-sm)', cursor: 'pointer', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <input type="checkbox" checked={consentMarketing} onChange={e => setConsentMarketing(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
          <span>[선택] 마케팅 정보 수신 동의 (신규 분양 현장 안내)</span>
        </label>
        <a href="/privacy" target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'underline', display: 'inline-block', marginTop: 6 }}>개인정보처리방침 보기</a>
      </div>

      <button onClick={handleGuestSubmit} disabled={submitting} style={{
        width: '100%', padding: 13, borderRadius: 'var(--radius-md)', border: 'none',
        background: consentCollection ? 'var(--brand)' : 'var(--bg-hover)',
        color: consentCollection ? '#fff' : 'var(--text-tertiary)',
        fontSize: 'var(--fs-base)', fontWeight: 700,
        cursor: consentCollection ? 'pointer' : 'not-allowed',
        opacity: submitting ? 0.5 : 1,
      }}>
        {submitting ? '등록 중...' : userId ? '정보 입력 후 등록하기' : '관심단지 등록하기'}
      </button>
    </div>
  );

  const Divider = ({ text }: { text: string }) => (
    <div style={{ position: 'relative', textAlign: 'center', margin: '14px 0' }}>
      <div style={{ height: 1, background: 'var(--border)', position: 'absolute', top: '50%', left: 0, right: 0 }} />
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-surface)', padding: '0 10px', position: 'relative' }}>{text}</span>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg-surface)', border: '2px solid var(--brand)', borderRadius: 'var(--radius-lg)', padding: '20px 16px', marginBottom: 'var(--sp-md)' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>관심단지 등록</div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>이 단지의 최신 정보가 나오면 알려드려요</p>
      </div>

      {/* 알림 혜택 필 태그 */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        {['청약 일정', '분양가 · 경쟁률', '입주 소식'].map(tag => (
          <span key={tag} style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontWeight: 600 }}>{tag}</span>
        ))}
      </div>

      {userId ? (
        <>
          {/* 로그인 유저: 원클릭 버튼 */}
          {registered ? (
            <button onClick={handleMemberUnregister} disabled={submitting} style={{
              width: '100%', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600,
              cursor: 'pointer', opacity: submitting ? 0.5 : 1,
            }}>
              ✅ 등록 완료 (탭하여 해제)
            </button>
          ) : (
            <button onClick={handleMemberRegister} disabled={submitting} style={{
              width: '100%', padding: 14, borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 'var(--fs-base)', fontWeight: 700,
              cursor: 'pointer', opacity: submitting ? 0.5 : 1,
            }}>
              {submitting ? '등록 중...' : '관심단지 등록하기 (+50P)'}
            </button>
          )}

          <Divider text="또는 정보를 직접 입력" />

          {/* 게스트 폼 (회원도 사용 가능) */}
          <GuestForm />
        </>
      ) : (
        <>
          {/* 비로그인: 게스트 폼 먼저 */}
          <GuestForm />

          <Divider text="또는" />

          {/* 회원 가입 유도 */}
          <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
              회원은 <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>입력 없이 원클릭</span> + <span style={{ fontWeight: 700, color: 'var(--brand)' }}>50P 적립</span>
            </p>
            <Link href={`/login?redirect=/apt/${slug}`} style={{
              display: 'block', padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
              fontSize: 'var(--fs-sm)', fontWeight: 700, textDecoration: 'none', textAlign: 'center',
            }}>
              카카오로 3초 가입 →
            </Link>
          </div>
        </>
      )}

      {/* 메시지 */}
      {message && (
        <p style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', marginTop: 10, color: message.includes('완료') || message.includes('적립') || message.includes('해제') ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
          {message}
        </p>
      )}

      {/* 소셜 프루프 */}
      <p style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-md)', marginBottom: 0 }}>
        현재 <span style={{ color: 'var(--brand)', fontWeight: 800 }}>{count}</span>명이 이 단지에 관심을 보이고 있어요
      </p>
    </div>
  );
}
