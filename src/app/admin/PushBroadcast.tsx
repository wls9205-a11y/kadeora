'use client';
import { useState } from 'react';

type PreviewDevice = 'android' | 'iphone' | 'chrome' | null;

export default function PushBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/feed');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState<PreviewDevice>(null);

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

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };
  const DEVICES: { key: PreviewDevice; label: string }[] = [
    { key: 'android', label: '🤖 Android' },
    { key: 'iphone', label: '🍎 iPhone' },
    { key: 'chrome', label: '💻 Chrome' },
  ];

  const LogoSvg = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#FF4500"/><circle cx="10" cy="16" r="4" fill="white"/><circle cx="16" cy="16" r="4" fill="white"/><circle cx="22" cy="16" r="4" fill="white"/></svg>
  );

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📣 푸시 알림 발송</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" style={inp} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="내용" rows={3} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (기본: /feed)" style={inp} />
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="이미지 URL (선택) — https://..." style={inp} />

        {/* 미리보기 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {DEVICES.map(d => (
            <button key={d.key} onClick={() => setPreview(preview === d.key ? null : d.key)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${preview === d.key ? 'var(--brand)' : 'var(--border)'}`, background: preview === d.key ? 'rgba(255,69,0,0.1)' : 'var(--bg-hover)', color: preview === d.key ? 'var(--brand)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
              {d.label}
            </button>
          ))}
        </div>

        {preview === 'android' && (
          <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 16, maxWidth: 340 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Android 알림</div>
            <div style={{ background: '#2a2a3e', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{title || '제목'}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{body || '내용'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>카더라 · 지금</div>
              </div>
            </div>
          </div>
        )}

        {preview === 'iphone' && (
          <div style={{ background: '#1c1c1e', borderRadius: 20, padding: 20, maxWidth: 320 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textAlign: 'center' }}>iPhone 잠금화면</div>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={16} /></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>카더라</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>지금</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{title || '제목'}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{body || '내용'}</div>
            </div>
          </div>
        )}

        {preview === 'chrome' && (
          <div style={{ background: '#292a2d', borderRadius: 12, padding: 16, maxWidth: 380 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Chrome 데스크탑</div>
            <div style={{ background: '#3c4043', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eaed', marginBottom: 2 }}>{title || '제목'}</div>
                <div style={{ fontSize: 12, color: 'rgba(232,234,237,0.7)', lineHeight: 1.4 }}>{body || '내용'}</div>
                <div style={{ fontSize: 10, color: 'rgba(232,234,237,0.4)', marginTop: 4 }}>kadeora.app</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
          style={{ padding: '12px 0', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
          {sending ? '발송 중...' : '🚀 전체 발송'}
        </button>
        {result && <div style={{ fontSize: 13, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)', padding: '4px 0' }}>{result}</div>}
      </div>
    </div>
  );
}
