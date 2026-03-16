'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function DeleteAccountSection() {
  const [step, setStep] = useState<'hidden'|'confirm'|'typing'>('hidden');
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    if (inputVal !== '탈퇴하겠습니다') return;
    setLoading(true);
    try {
      await fetch('/api/account/delete', { method: 'DELETE' });
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      setLoading(false);
    }
  };

  // 완전히 숨겨진 상태 — 작은 링크 텍스트만 노출
  if (step === 'hidden') {
    return (
      <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setStep('confirm')}
          className="text-xs"
          style={{ color: 'var(--text-tertiary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          회원 탈퇴
        </button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="mt-8 p-4 rounded-xl" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)' }}>
        <p className="font-semibold text-sm mb-2" style={{ color: 'var(--error)' }}>정말 탈퇴하시겠습니까?</p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          탈퇴 시 모든 게시글, 댓글, 포인트가 삭제되며 복구할 수 없습니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('hidden')}
            className="text-sm px-4 py-2 rounded-full"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            취소
          </button>
          <button
            onClick={() => setStep('typing')}
            className="text-sm px-4 py-2 rounded-full"
            style={{ backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
          >
            계속
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 p-4 rounded-xl" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)' }}>
      <p className="font-semibold text-sm mb-1" style={{ color: 'var(--error)' }}>최종 확인</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        아래 입력창에 <strong>탈퇴하겠습니다</strong>를 정확히 입력하세요.
      </p>
      <input
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        placeholder="탈퇴하겠습니다"
        className="w-full text-sm px-3 py-2 rounded-lg mb-3"
        style={{ backgroundColor: 'var(--bg-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
      />
      <div className="flex gap-2">
        <button
          onClick={() => { setStep('hidden'); setInputVal(''); }}
          className="text-sm px-4 py-2 rounded-full"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          취소
        </button>
        <button
          onClick={handleDelete}
          disabled={inputVal !== '탈퇴하겠습니다' || loading}
          className="text-sm px-4 py-2 rounded-full"
          style={{
            backgroundColor: inputVal === '탈퇴하겠습니다' ? 'var(--error)' : 'var(--bg-active)',
            color: inputVal === '탈퇴하겠습니다' ? '#fff' : 'var(--text-disabled)',
            border: 'none',
            cursor: inputVal === '탈퇴하겠습니다' ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? '처리 중...' : '최종 탈퇴'}
        </button>
      </div>
    </div>
  );
}
