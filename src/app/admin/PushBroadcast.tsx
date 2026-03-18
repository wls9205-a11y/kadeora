'use client';
import { useState } from 'react';

export default function PushBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/feed');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true); setResult('');
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url, ...(imageUrl ? { image: imageUrl } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ 앱내 ${data.app_notif}명, 푸시 ${data.push_sent}/${data.push_total}명 발송`);
        setTitle(''); setBody('');
      } else { setResult(`❌ ${data.error}`); }
    } catch { setResult('❌ 발송 실패'); }
    setSending(false);
  };

  const inp = { width: '100%' as const, padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📣 푸시 알림 발송</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" style={inp} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="내용" rows={3} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (기본: /feed)" style={inp} />
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="이미지 URL (선택) — https://..." style={inp} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPreview(p => !p)} disabled={!title.trim()}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            {preview ? '닫기' : '👁 미리보기'}
          </button>
          <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
            style={{ flex: 1, padding: '10px 0', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? '발송 중...' : '🚀 전체 발송'}
          </button>
        </div>
        {preview && title.trim() && (
          <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>미리보기 — Android 푸시 알림</div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📡</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{body || '(내용 없음)'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>카더라 · 방금</div>
              </div>
            </div>
          </div>
        )}
        {result && <div style={{ fontSize: 13, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)', padding: '4px 0' }}>{result}</div>}
      </div>
    </div>
  );
}
