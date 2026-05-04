'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SegmentFilter } from './SegmentBuilder';

interface SendResult {
  delivered?: number;
  blocked?: { by_reason?: Record<string, number> };
}

const FOOTER = '\n\n무료수신거부: 마이페이지 > 알림 설정';

export default function SendModal({
  open,
  onClose,
  filter,
  segmentName,
}: {
  open: boolean;
  onClose: () => void;
  filter: SegmentFilter;
  segmentName: string;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hour, setHour] = useState<number>(() => new Date().getHours());

  useEffect(() => {
    if (!open) return;
    setHour(new Date().getHours());
    setResult(null);
    setErr(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const isAd = filter.message_type === 'ad';
  const isNightWindow = hour >= 21 || hour < 8;
  const showNightWarning = isAd && isNightWindow;

  const preview = useMemo(() => {
    const prefix = isAd ? '(광고) ' : '';
    return `${prefix}${title}\n${body}${isAd ? FOOTER : ''}`;
  }, [title, body, isAd]);

  if (!open) return null;

  const onConfirm = async () => {
    if (busy) return;
    if (!title.trim() || !body.trim()) {
      alert('제목/본문을 입력하세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/marketing/kakao/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          filter_json: filter,
          segment_name: segmentName,
          message_type: filter.message_type,
        }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const j: SendResult = await r.json();
      setResult(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 18,
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--bg-elevated, #1f2028)',
          border: '1px solid var(--border, #2a2b35)',
          color: 'var(--text-primary, #fff)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>📤 카카오 발송</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary, #888)',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {showNightWarning && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.5)',
              color: '#f87171',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ⚠ 야간 동의 사용자만 발송됩니다 (21:00–07:59)
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: 13,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--bg-base, #0d0e14)',
              color: 'var(--text-primary, #fff)',
              border: '1px solid var(--border, #2a2b35)',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>본문</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            style={{
              fontSize: 13,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--bg-base, #0d0e14)',
              color: 'var(--text-primary, #fff)',
              border: '1px solid var(--border, #2a2b35)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'var(--bg-base, #0d0e14)',
            border: '1px solid var(--border, #2a2b35)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #888)', marginBottom: 4 }}>미리보기</div>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              color: 'var(--text-primary, #fff)',
            }}
          >
            {preview}
          </pre>
        </div>

        {err && (
          <div style={{ fontSize: 12, color: '#f87171' }}>발송 실패: {err}</div>
        )}

        {result && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.4)',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div>
              <strong>배달:</strong> {result.delivered ?? 0}
            </div>
            {result.blocked?.by_reason && (
              <div>
                <strong>차단:</strong>{' '}
                {Object.entries(result.blocked.by_reason)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(', ') || '없음'}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--text-secondary, #ccc)',
              border: '1px solid var(--border, #2a2b35)',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: 6,
              cursor: busy ? 'wait' : 'pointer',
              background: 'var(--accent, #3b82f6)',
              color: '#fff',
              border: '1px solid var(--accent, #3b82f6)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '발송 중…' : '발송'}
          </button>
        </div>
      </div>
    </div>
  );
}
