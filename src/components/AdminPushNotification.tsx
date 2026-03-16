'use client';
import { useState } from 'react';

export default function AdminPushNotification() {
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [url,     setUrl]     = useState('/feed');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) { alert('제목과 내용을 입력하세요'); return; }
    if (!confirm(`전체 유저에게 공지를 발송하시겠습니까?\n"${title}"`)) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, url, target: 'all' }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ 발송 완료 — 앱 내 알림 ${data.sent}명 전송됨`);
        setTitle(''); setBody('');
      } else {
        setResult(`❌ 오류: ${data.error}`);
      }
    } catch (e) { setResult('❌ 네트워크 오류'); }
    setLoading(false);
  }

  return (
    <div style={{
      background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
      borderRadius: 8, padding: 20, marginTop: 20,
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--kd-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
        🔔 전체 공지 발송
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kd-text-muted)', display: 'block', marginBottom: 4 }}>제목</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목 (예: 서버 점검 안내)"
            className="kd-input"
            style={{ fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kd-text-muted)', display: 'block', marginBottom: 4 }}>내용</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="공지 내용을 입력하세요..."
            rows={3}
            style={{
              width: '100%', padding: '10px 14px', resize: 'vertical',
              background: 'var(--kd-surface-2)', border: '1px solid var(--kd-border)',
              borderRadius: 4, color: 'var(--kd-text)', fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--kd-text-muted)', display: 'block', marginBottom: 4 }}>이동 URL (클릭 시)</label>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="/feed"
            className="kd-input"
            style={{ fontSize: 14 }}
          />
        </div>
        <button onClick={send} disabled={loading}
          style={{
            padding: '10px 20px', background: loading ? 'var(--kd-border)' : '#FF4500',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '발송 중...' : '📢 전체 유저에게 공지 발송'}
        </button>
        {result && (
          <div style={{
            padding: '10px 14px', borderRadius: 4, fontSize: 13,
            background: result.startsWith('✅') ? 'var(--kd-success-dim)' : 'var(--kd-danger-dim)',
            color: result.startsWith('✅') ? 'var(--kd-success)' : 'var(--kd-danger)',
            border: `1px solid ${result.startsWith('✅') ? 'var(--kd-success)' : 'var(--kd-danger)'}`,
          }}>{result}</div>
        )}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--kd-text-dim)' }}>
        * 발송 시 모든 유저의 앱 내 알림에 공지가 추가됩니다.<br/>
        * Web Push (브라우저 백그라운드 알림)는 VAPID 키 설정 후 활성화됩니다.
      </p>
    </div>
  );
}