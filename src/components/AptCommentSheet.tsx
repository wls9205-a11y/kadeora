'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props { houseKey: string; houseNm: string; houseType: 'sub' | 'unsold'; open: boolean; onClose: () => void; }

export default function AptCommentSheet({ houseKey, houseNm, houseType, open, onClose }: Props) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    createSupabaseBrowser().auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/apt/comments?house_key=${encodeURIComponent(houseKey)}`).then(r => r.json()).then(d => setComments(d.comments || []));
  }, [open, houseKey]);

  useEffect(() => {
    if (!open) return;
    const sb = createSupabaseBrowser();
    const ch = sb.channel(`apt-${houseKey}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'apt_comments', filter: `house_key=eq.${houseKey}` }, (payload: any) => {
      setComments(p => [{ ...payload.new, nickname: '새 댓글' }, ...p]);
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [open, houseKey]);

  useEffect(() => { if (open) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; return () => { document.body.style.overflow = ''; }; }, [open]);

  const submit = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const res = await fetch('/api/apt/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ house_key: houseKey, house_nm: houseNm, house_type: houseType, content: text.trim() }) });
    if (res.ok) { const d = await res.json(); setComments(p => [d.comment, ...p]); setText(''); }
    setSending(false);
  };

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: '12px 20px 32px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', transition: 'transform 0.25s ease' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>✏️ {houseNm} 한줄평</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
          {comments.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 14 }}>첫 한줄평을 남겨보세요! 👋</div>}
          {comments.map((c: any) => (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{c.nickname}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
            </div>
          ))}
        </div>
        {user ? (
          <div>
            <div style={{ position: 'relative' }}>
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))} rows={2} maxLength={200} placeholder="이 현장 어때요? (200자)"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>{text.length}/200</span>
            </div>
            <button onClick={submit} disabled={sending || !text.trim()} style={{ marginTop: 8, width: '100%', padding: '10px 0', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: !text.trim() ? 0.5 : 1 }}>
              {sending ? '등록 중...' : '등록'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 12 }}>
            <a href="/login" style={{ color: 'var(--brand)' }}>로그인</a> 후 한줄평을 남길 수 있어요
          </div>
        )}
      </div>
    </>
  );
}
