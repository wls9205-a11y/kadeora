'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

type PostMode = 'short' | 'poll' | 'predict';

const MODES: { id: PostMode; icon: string; label: string }[] = [
  { id: 'short', icon: '💬', label: '한마디' },
  { id: 'poll', icon: '📊', label: '투표' },
  { id: 'predict', icon: '🔮', label: '예측' },
];

export default function QuickPostBar({ category = 'free', regionId = '' }: { category?: string; regionId?: string }) {
  const router = useRouter();
  const { userId } = useAuth();
  const { success, error: showError } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<PostMode>('short');
  const [text, setText] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [predictDir, setPredictDir] = useState<'up' | 'down'>('up');
  const [predictDeadline, setPredictDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleExpand = () => {
    if (!userId) { router.push('/login?redirect=/feed&source=quickpost'); return; }
    setExpanded(true);
    setTimeout(() => textRef.current?.focus(), 100);
  };

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    try {
      let endpoint = '/api/feed/short';
      let body: Record<string, unknown> = { content: text.trim(), category, region_id: regionId };

      if (mode === 'poll') {
        const validOpts = pollOpts.filter(o => o.trim());
        if (validOpts.length < 2) { showError('선택지를 2개 이상 입력하세요'); setSubmitting(false); return; }
        endpoint = '/api/feed/poll';
        body = { question: text.trim(), options: validOpts, category, region_id: regionId };
      } else if (mode === 'predict') {
        if (!predictDeadline) { showError('기한을 설정하세요'); setSubmitting(false); return; }
        endpoint = '/api/feed/predict';
        // target은 본문에서 추출 (간단히 전체 텍스트 사용)
        body = {
          title: text.trim(),
          target: text.trim().split(/\s/).slice(-2).join(' ') || text.trim(),
          direction: predictDir,
          deadline: predictDeadline,
          category,
          region_id: regionId,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || '작성 실패');
        setSubmitting(false);
        return;
      }

      const points = mode === 'short' ? 5 : 10;
      success(`작성 완료! +${points}P 적립`);
      setText('');
      setPollOpts(['', '']);
      setExpanded(false);
      router.refresh();
    } catch {
      showError('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <div onClick={handleExpand} style={{
        padding: '16px 18px', background: 'var(--bg-surface)',
        borderRadius: 20, border: '1px solid rgba(59,123,246,0.12)',
        marginBottom: 'var(--sp-md)', cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}>
        {/* 상단: 아이콘 + 타이틀 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>지금 무슨 생각하세요?</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>주식, 부동산, 일상 뭐든 좋아요</div>
          </div>
        </div>

        {/* 입력 영역 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-hover)', borderRadius: 14,
          padding: '10px 14px', border: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13, flex: 1 }}>탭해서 이야기 시작하기...</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.5 }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.12)' }}>
            <span style={{ fontSize: 11, color: '#A78BFA', fontWeight: 600 }}>📊 투표</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 10, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.1)' }}>
            <span style={{ fontSize: 11, color: '#22D3EE', fontWeight: 600 }}>🔮 예측</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.1)' }}>
            <span style={{ fontSize: 11, color: 'rgba(52,211,153,0.7)', fontWeight: 500 }}>+5P</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)',
      border: '1px solid var(--brand-dim, rgba(59,123,246,0.2))',
      padding: 'var(--sp-md)', marginBottom: 'var(--sp-md)',
      boxShadow: '0 0 30px rgba(59,123,246,0.08)',
    }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-sm)' }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12,
            background: mode === m.id ? 'rgba(59,123,246,0.08)' : 'transparent',
            border: mode === m.id ? '1px solid rgba(59,123,246,0.2)' : '1px solid transparent',
            color: mode === m.id ? 'var(--brand)' : 'var(--text-tertiary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
            fontWeight: mode === m.id ? 600 : 400,
          }}>{m.icon} {m.label}</button>
        ))}
      </div>

      {/* Text input */}
      <textarea
        ref={textRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={
          mode === 'short' ? '지금 무슨 생각하세요?' :
          mode === 'poll' ? '투표 질문을 입력하세요' :
          '예측 내용을 입력하세요 (예: 삼성전자 다음 주 9만원)'
        }
        maxLength={500}
        style={{
          width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)',
          fontSize: 'var(--fs-sm)', resize: 'none', outline: 'none', fontFamily: 'inherit',
          height: mode === 'short' ? 48 : 70, lineHeight: 1.5,
        }}
      />

      {/* Poll options */}
      {mode === 'poll' && (
        <div style={{ marginTop: 'var(--sp-xs)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pollOpts.map((o, i) => (
            <input key={i} value={o}
              onChange={e => { const n = [...pollOpts]; n[i] = e.target.value; setPollOpts(n); }}
              placeholder={`선택지 ${i + 1}`}
              maxLength={50}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'inherit',
              }}
            />
          ))}
          {pollOpts.length < 4 && (
            <button onClick={() => setPollOpts([...pollOpts, ''])} style={{
              background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
              padding: 6, color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
            }}>+ 선택지 추가</button>
          )}
        </div>
      )}

      {/* Predict options */}
      {mode === 'predict' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 'var(--sp-xs)' }}>
          <select value={predictDir} onChange={e => setPredictDir(e.target.value as 'up' | 'down')} style={{
            flex: 1, padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, outline: 'none',
          }}>
            <option value="up">📈 상승</option>
            <option value="down">📉 하락</option>
          </select>
          <input type="date" value={predictDeadline} onChange={e => setPredictDeadline(e.target.value)} style={{
            flex: 1, padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, outline: 'none', colorScheme: 'dark',
          }} />
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-sm)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {text.length}/500 · +{mode === 'short' ? 5 : 10}P
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setExpanded(false); setText(''); }} style={{
            padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-hover)',
            border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>취소</button>
          <button onClick={handleSubmit} disabled={!text.trim() || submitting} style={{
            padding: '5px 14px', borderRadius: 'var(--radius-pill)',
            background: text.trim() ? 'var(--brand)' : 'var(--bg-hover)',
            border: 'none', color: text.trim() ? '#fff' : 'var(--text-tertiary)',
            fontSize: 12, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default',
            opacity: submitting ? 0.6 : 1,
          }}>{submitting ? '작성중...' : '던지기'}</button>
        </div>
      </div>
    </div>
  );
}
