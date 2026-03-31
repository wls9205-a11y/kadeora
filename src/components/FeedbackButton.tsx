'use client';
import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async () => {
    if (!message.trim()) { error('내용을 입력해주세요'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), category: category || undefined }),
      });
      if (res.ok) {
        success('소중한 의견 감사합니다!');
        setMessage(''); setCategory(''); setOpen(false);
      } else {
        const d = await res.json();
        error(d.error || '전송 실패');
      }
    } catch { error('네트워크 오류'); }
    setSubmitting(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
        background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)',
        fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
      }}>
        💬 건의 · 피드백 보내기
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="건의 · 피드백" maxWidth={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{
            width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', cursor: 'pointer',
          }}>
            <option value="">카테고리 선택 (선택)</option>
            <option value="bug">버그 신고</option>
            <option value="feature">기능 제안</option>
            <option value="content">콘텐츠 요청</option>
            <option value="other">기타</option>
          </select>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="어떤 점이 불편하셨나요? 어떤 기능이 있었으면 좋겠나요?" rows={5}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', resize: 'vertical', fontFamily: 'inherit',
            }} />
          <button onClick={handleSubmit} disabled={submitting || !message.trim()} style={{
            width: '100%', padding: '13px', borderRadius: 'var(--radius-md)', border: 'none',
            background: message.trim() ? 'var(--brand)' : 'var(--bg-hover)',
            color: message.trim() ? '#fff' : 'var(--text-tertiary)',
            fontSize: 'var(--fs-base)', fontWeight: 700,
            cursor: message.trim() ? 'pointer' : 'not-allowed',
            opacity: submitting ? 0.5 : 1,
          }}>{submitting ? '전송 중...' : '보내기'}</button>
        </div>
      </BottomSheet>
    </>
  );
}
