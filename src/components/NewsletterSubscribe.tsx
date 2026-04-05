'use client';
/**
 * NewsletterSubscribe — 이메일 뉴스레터 구독 (가입 불필요)
 *
 * 개인정보보호법 준수: 수집 동의 체크박스 + 목적/항목/보유기간 고지
 * 정보통신망법 제50조: 수신 동의 필수
 */
import { useState } from 'react';
import { trackConversion } from '@/lib/track-conversion';

export default function NewsletterSubscribe({ category }: { category?: string }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || status === 'success') {
    if (status === 'success') {
      return (
        <div style={{ margin: '24px 0', padding: '16px', background: 'var(--accent-green-bg)', border: '1px solid var(--accent-green-border)', borderRadius: 'var(--radius-card)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>구독 완료!</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>매주 월요일, 핵심 정보를 보내드릴게요</div>
        </div>
      );
    }
    return null;
  }

  const handleSubmit = async () => {
    if (!email || !consent) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('error'); return; }
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, category: category || 'general', consent: true }),
      });
      if (res.ok) {
        setStatus('success');
        trackConversion('cta_complete', 'newsletter', { category });
        localStorage.setItem('kd_newsletter_subscribed', '1');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  // 이미 구독했으면 표시 안 함
  if (typeof window !== 'undefined' && localStorage.getItem('kd_newsletter_subscribed')) return null;

  return (
    <div style={{
      margin: '24px 0', padding: '20px',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        주간 부동산·주식 리포트
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
        매주 월요일, 핵심 시장 동향을 이메일로 정리해 드립니다. 가입 없이 이메일만 입력하세요.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일 주소"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--bg-base)',
            color: 'var(--text-primary)', fontSize: 13,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!email || !consent || status === 'loading'}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            background: consent && email ? 'var(--brand)' : 'var(--bg-hover)',
            color: consent && email ? '#fff' : 'var(--text-tertiary)',
            fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            opacity: status === 'loading' ? 0.5 : 1,
          }}
        >{status === 'loading' ? '...' : '구독'}</button>
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          style={{ accentColor: 'var(--brand)', width: 14, height: 14, marginTop: 2, flexShrink: 0 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          <span style={{ color: 'var(--error)', fontWeight: 700 }}>[필수]</span>{' '}
          개인정보 수집·이용 동의 (이메일 주소 수집, 뉴스레터 발송 목적, 구독 해지 시까지 보유)
        </span>
      </label>

      {status === 'error' && (
        <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>
          올바른 이메일을 입력해주세요
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button onClick={() => setDismissed(true)} style={{
          background: 'none', border: 'none', fontSize: 11,
          color: 'var(--text-tertiary)', cursor: 'pointer',
        }}>닫기</button>
      </div>
    </div>
  );
}
