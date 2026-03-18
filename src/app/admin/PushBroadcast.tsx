'use client';
import { useState } from 'react';

export default function PushBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/feed');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult('');
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`발송 완료: 앱내 ${data.app_notif}명, 푸시 ${data.push_sent}/${data.push_total}명`);
        setTitle(''); setBody('');
      } else {
        setResult(`오류: ${data.error}`);
      }
    } catch {
      setResult('발송 실패');
    }
    setSending(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📣 푸시 알림 발송</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" style={{
          padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
        }} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="내용" rows={3} style={{
          padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
        }} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (기본: /feed)" style={{
          padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
        }} />
        <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()} style={{
          padding: '10px 0', background: 'var(--brand)', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
        }}>
          {sending ? '발송 중...' : '전체 발송'}
        </button>
        {result && <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>{result}</div>}
      </div>
    </div>
  );
}
