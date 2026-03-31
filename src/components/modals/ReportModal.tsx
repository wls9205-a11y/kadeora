'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

interface ReportModalProps {
  targetType: 'post' | 'comment' | 'chat';
  targetId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: 'spam',          label: '스팸/광고' },
  { value: 'abuse',         label: '욕설/비방' },
  { value: 'defamation',    label: '명예훼손' },
  { value: 'misinformation',label: '허위 정보' },
  { value: 'copyright',     label: '저작권 침해' },
  { value: 'privacy',       label: '개인정보 노출' },
  { value: 'other',         label: '기타' },
];

// 콘텐츠 신고/삭제 프로세스 (정통망법 제44조)
export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { info, error: showError } = useToast();
  const { userId } = useAuth();

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      if (!userId) { info('로그인하면 신고할 수 있어요'); onClose(); return; }
      const sb = createSupabaseBrowser();
      await sb.from('content_reports').insert({
        reporter_id: userId,
        target_type: targetType,
        target_id: Number(targetId),
        reason: `${reason}${detail ? `: ${detail}` : ''}`,
      });
      setSubmitted(true);
    } catch {
      showError('신고 접수에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          padding: 28, maxWidth: 440, width: '100%',
        }}
        className="animate-modalIn"
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--sp-md)' }}>✅</div>
            <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              신고가 접수되었습니다
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
              24시간 내 1차 검토 후 72시간 내 처리 결과를 안내드립니다.
            </p>
            <button
              onClick={onClose}
              className="kd-btn kd-btn-primary"
              style={{ padding: 'var(--sp-md) var(--sp-2xl)', fontSize: 'var(--fs-sm)' }}
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              🚨 콘텐츠 신고
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
              {REPORT_REASONS.map(r => (
                <label
                  key={r.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    border: `1px solid ${reason === r.value ? 'var(--brand)' : 'var(--border)'}`,
                    background: reason === r.value ? 'var(--brand)' : 'transparent',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={e => setReason(e.target.value)}
                    style={{ accentColor: 'var(--brand)' }}
                  />
                  <span style={{
                    fontSize: 'var(--fs-sm)',
                    color: reason === r.value ? 'var(--brand)' : 'var(--text-secondary)',
                    fontWeight: reason === r.value ? 600 : 400,
                  }}>
                    {r.label}
                  </span>
                </label>
              ))}
            </div>

            <textarea
              placeholder="상세 내용 (선택사항)"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              maxLength={500}
              rows={3}
              style={{
                width: '100%', padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)', boxSizing: 'border-box',
                border: '1px solid var(--border)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none', resize: 'none',
                marginBottom: 'var(--sp-lg)', fontFamily: 'inherit', lineHeight: 1.5,
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                className="kd-btn kd-btn-ghost"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="kd-btn kd-btn-danger"
                style={{
                  fontSize: 'var(--fs-sm)',
                  opacity: reason ? 1 : 0.5,
                  cursor: reason ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting ? '접수 중...' : '신고하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}