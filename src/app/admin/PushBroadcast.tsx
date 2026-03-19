'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type PreviewDevice = 'android' | 'iphone' | 'chrome' | null;

export default function PushBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/feed');
  const [imageUrl, setImageUrl] = useState('');
  const [sendTarget, setSendTarget] = useState<'all'|'web'|'app'>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [_preview] = useState<PreviewDevice>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    createSupabaseBrowser().from('push_logs').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setLogs(data || []));
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true); setResult('');
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url, target: sendTarget, ...(imageUrl ? { image: imageUrl } : {}) }),
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
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>발송 대상</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([{ key: 'all' as const, label: '📡 전체' }, { key: 'web' as const, label: '🌐 웹' }, { key: 'app' as const, label: '📱 앱' }]).map(t => (
              <button key={t.key} onClick={() => setSendTarget(t.key)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${sendTarget === t.key ? 'var(--brand)' : 'var(--border)'}`,
                background: sendTarget === t.key ? 'var(--brand)' : 'var(--bg-hover)',
                color: sendTarget === t.key ? 'var(--text-inverse)' : 'var(--text-secondary)', cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" style={inp} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="내용" rows={3} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (기본: /feed)" style={inp} />
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="이미지 URL (선택) — https://..." style={inp} />

        {/* 미리보기 2×2 그리드 */}
        {(title.trim() || body.trim()) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            {/* Android */}
            <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>🤖 Android</div>
              <div style={{ background: '#2a2a3e', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{title || '제목'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{body || '내용'}</div>
                </div>
              </div>
            </div>
            {/* iPhone */}
            <div style={{ background: '#1c1c1e', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>🍎 iPhone</div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={12} /></div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>카더라</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{title || '제목'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>{body || '내용'}</div>
              </div>
            </div>
            {/* Chrome */}
            <div style={{ background: '#292a2d', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>💻 Chrome</div>
              <div style={{ background: '#3c4043', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 5, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={14} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e8eaed' }}>{title || '제목'}</div>
                <div style={{ fontSize: 10, color: 'rgba(232,234,237,0.65)', lineHeight: 1.3 }}>{body || '내용'}</div>
              </div>
            </div>
            </div>
            {/* Safari */}
            <div style={{ background: '#1e1e1e', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>🧭 Safari</div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={12} /></div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>카더라</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{title || '제목'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{body || '내용'}</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
          style={{ padding: '12px 0', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
          {sending ? '발송 중...' : `🚀 ${sendTarget === 'all' ? '전체' : sendTarget === 'web' ? '웹' : '앱'} 발송`}
        </button>
        {result && <div style={{ fontSize: 13, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)', padding: '4px 0' }}>{result}</div>}

        {/* 발송 내역 */}
        {logs.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>📊 발송 내역</div>
            {logs.map((l: any) => {
              const ctr = l.sent_count > 0 ? Math.round((l.click_count / l.sent_count) * 100) : 0;
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{new Date(l.created_at).toLocaleDateString('ko-KR')}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>발송 {l.sent_count}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>클릭 {l.click_count}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: ctr >= 10 ? 'var(--success)' : ctr >= 5 ? 'var(--warning)' : 'var(--text-tertiary)' }}>{ctr}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
