'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Props {
  postId?: number;
  commentId?: number;
  messageId?: number;
}

const REASONS = [
  '허위정보 · 시세조종 의심',
  '욕설 · 비방 · 혐오 표현',
  '광고 · 스팸 · 홍보',
  '개인정보 노출',
  '기타',
];

export default function ReportButton({ postId, commentId, messageId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleSubmit = async () => {
    if (!reason) {
      setResult('신고 사유를 선택해주세요');
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const sb = createSupabaseBrowser();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setResult('로그인이 필요합니다');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, commentId, messageId, reason, details: details.trim() || undefined }),
      });

      if (res.status === 409) {
        setResult('이미 신고한 콘텐츠입니다');
      } else if (res.ok) {
        setResult('신고가 접수되었습니다');
        setTimeout(() => {
          setOpen(false);
          setReason('');
          setDetails('');
          setResult('');
        }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setResult(data.error || '신고 처리 중 오류가 발생했습니다');
      }
    } catch {
      setResult('신고 처리 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="신고"
        style={{
          fontSize: 12,
          opacity: 0.5,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          padding: '2px 4px',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
      >
        신고
      </button>

      {open && (
        <div
          onClick={() => { setOpen(false); setResult(''); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '24px 28px',
              width: '100%',
              maxWidth: 400,
              margin: '0 16px',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              신고하기
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {REASONS.map(r => (
                <label
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    style={{ accentColor: 'var(--brand)' }}
                  />
                  {r}
                </label>
              ))}
            </div>

            {reason === '기타' && (
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="상세 사유를 입력해주세요 (최대 200자)"
                maxLength={200}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  fontSize: 13,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                  marginBottom: 12,
                }}
              />
            )}

            {result && (
              <div style={{
                fontSize: 13,
                color: result.includes('접수') ? 'var(--success)' : 'var(--error)',
                marginBottom: 12,
              }}>
                {result}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => { setOpen(false); setReason(''); setDetails(''); setResult(''); }}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !reason}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--error)',
                  color: 'var(--text-inverse)',
                  cursor: loading || !reason ? 'not-allowed' : 'pointer',
                  opacity: loading || !reason ? 0.5 : 1,
                  fontWeight: 600,
                }}
              >
                {loading ? '처리 중...' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
