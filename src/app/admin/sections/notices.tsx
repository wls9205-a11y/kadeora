'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge, C, DataTable, Pill, Spinner, ago } from '../admin-shared';

export default function NoticesSection() {
  const [tab, setTab] = useState<'notices' | 'push'>('notices');
  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 16px' }}>📢 공지 · 알림</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <Pill active={tab === 'notices'} onClick={() => setTab('notices')}>📡 공지 전광판</Pill>
        <Pill active={tab === 'push'} onClick={() => setTab('push')}>📣 푸시 알림</Pill>
      </div>
      {tab === 'notices' && <NoticeManager />}
      {tab === 'push' && <PushManager />}
    </div>
  );
}

function NoticeManager() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/notices').then(r => r.json()).then(d => setHistory(d.notices || [])).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/notices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) { setResult('공지가 등록됐어요!'); setContent(''); load(); }
      else setResult('저장 실패');
    } catch { setResult('저장 실패'); }
    setSaving(false);
    setTimeout(() => setResult(''), 3000);
  };

  const reactivate = async (id: number) => {
    await fetch('/api/admin/notices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: true }),
    });
    load();
  };

  const deactivate = async (id: number) => {
    await fetch('/api/admin/notices', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: false }),
    });
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>새 공지 등록</div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="전광판에 표시할 공지 내용..." rows={3}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text, padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving || !content.trim()} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', background: content.trim() ? C.brand : C.border,
            color: content.trim() ? '#fff' : C.textDim, fontSize: 12, fontWeight: 700, cursor: content.trim() ? 'pointer' : 'not-allowed',
          }}>{saving ? '저장 중...' : '전광판 등록'}</button>
          {result && <span style={{ fontSize: 12, color: result.includes('등록') ? C.green : C.red }}>{result}</span>}
        </div>
      </div>

      <DataTable
        headers={['내용', '상태', '등록일', '조치']}
        rows={history.map(n => [
          <span key="c" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{n.content}</span>,
          n.is_active ? <Badge key="s" color={C.green}>활성</Badge> : <Badge key="s" color={C.textDim}>종료</Badge>,
          ago(n.created_at),
          n.is_active
            ? <button key="a" onClick={() => deactivate(n.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>비활성</button>
            : <button key="a" onClick={() => reactivate(n.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.greenBg, color: C.green, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>재활성</button>,
        ])}
      />
    </div>
  );
}

function PushManager() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/feed');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/push-stats').then(r => r.json()).catch(() => ({ logs: [], subCount: 0 })),
    ]).then(([stats]) => {
      setLogs(stats.logs || []);
      setSubCount(stats.subCount || 0);
      setLoading(false);
    });
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/push-broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url, target_all: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`발송 완료: ${data.push_sent || 0}명 푸시, ${data.notifications_created || 0}명 알림`);
        setTitle(''); setBody('');
      } else setResult(`발송 실패: ${data.error}`);
    } catch { setResult('발송 실패'); }
    setSending(false);
    setTimeout(() => setResult(''), 5000);
  };

  if (loading) return <Spinner />;

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: 11, color: C.textDim }}>📱 푸시 구독자</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.brand }}>{subCount}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: 11, color: C.textDim }}>📨 총 발송</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{logs.length}</div>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>새 푸시 발송</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" style={inp} />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="내용" rows={3} style={{ ...inp, resize: 'vertical' as const }} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (기본: /feed)" style={inp} />
          <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()} style={{
            padding: '10px 0', background: C.brand, color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
          }}>{sending ? '발송 중...' : '전체 발송'}</button>
          {result && <span style={{ fontSize: 12, color: result.includes('완료') ? C.green : C.red }}>{result}</span>}
        </div>
      </div>

      <DataTable
        headers={['제목', '발송일', '발송수', '클릭', 'CTR']}
        rows={logs.map(l => {
          const ctr = l.sent_count > 0 ? Math.round(((l.click_count || 0) / l.sent_count) * 100) : 0;
          return [
            <span key="t" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{l.title}</span>,
            ago(l.created_at),
            l.sent_count || 0,
            l.click_count || 0,
            <Badge key="c" color={ctr >= 10 ? C.green : ctr >= 5 ? C.yellow : C.textDim}>{ctr}%</Badge>,
          ];
        })}
      />
    </div>
  );
}
