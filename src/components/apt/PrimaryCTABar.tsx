// components/apt/PrimaryCTABar.tsx
'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function PrimaryCTABar({
  slug,
  siteName,
  isAuthed,
  className = '',
}: {
  slug: string;
  siteName: string;
  isAuthed: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentThirdParty, setConsentThirdParty] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = () => {
    if (!isAuthed) {
      router.push(
        `/login?redirect=${encodeURIComponent(`${pathname}?unlock=1`)}&source=apt_register_cta`,
      );
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!consentMarketing) {
      setError('마케팅 정보 수신 동의가 필요합니다');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/apt/subscription/register-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          consent_marketing: consentMarketing,
          consent_third_party: consentThirdParty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || 'UNKNOWN';
        if (msg === 'DAILY_LIMIT_EXCEEDED') setError('하루 5건까지만 등록 가능합니다');
        else if (msg === 'AUTH_REQUIRED') {
          router.push(`/login?source=apt_register_cta`);
          return;
        } else setError(`등록 실패 (${msg})`);
        return;
      }
      setDone(true);
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setError('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`w-full bg-yellow-300 hover:bg-yellow-400 active:scale-[0.99] text-black font-bold py-3.5 rounded-xl transition-all shadow-sm ${className}`}
      >
        관심 단지 등록 · D-day 알림 받기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!done ? (
              <>
                <h3 className="font-bold text-lg mb-1">관심 단지 등록</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  <b>{siteName}</b> 청약 D-day, 당첨자 발표 등 주요 일정을 카카오톡으로 알려드립니다.
                </p>

                <label className="flex items-start gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentMarketing}
                    onChange={(e) => setConsentMarketing(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <b>(필수)</b> 마케팅 정보 수신 동의 — 청약 일정·당첨자 발표 알림톡 (보유 6개월)
                  </span>
                </label>
                <label className="flex items-start gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentThirdParty}
                    onChange={(e) => setConsentThirdParty(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    (선택) 분양 대행사에 정보 제공 동의 — 모델하우스 방문·평형 안내
                  </span>
                </label>

                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !consentMarketing}
                  className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-colors"
                >
                  {submitting ? '등록 중...' : '등록하기 · 50P 적립'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full mt-2 text-sm text-slate-500 py-2"
                >
                  취소
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-2" aria-hidden="true">
                  ✓
                </div>
                <h3 className="font-bold text-lg mb-1">등록 완료</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  카카오톡 알림으로 일정을 안내드립니다 · 50P 적립
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
