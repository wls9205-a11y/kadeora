'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { timeAgo } from '@/lib/format';
import { getAvatarColor } from '@/lib/avatar';

export default function AptCommentInline({ houseKey, houseNm, houseType }: { houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' }) {
  const pathname = usePathname();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    fetch(`/api/apt/comments?house_key=${encodeURIComponent(houseKey)}`).then(r => r.json()).then(d => setComments(d.comments || []));
  }, [houseKey]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    const ch = sb.channel(`apt-inline-${houseKey}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'apt_comments', filter: `house_key=eq.${houseKey}` }, (payload: { new: Record<string, any> }) => {
      setComments(p => [{ ...payload.new, nickname: '새 댓글' }, ...p]);
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [houseKey]);

  const submit = async () => {
    if (!text.trim() || !userId) return;
    setSending(true);
    const res = await fetch('/api/apt/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ house_key: houseKey, house_nm: houseNm, house_type: houseType, content: text.trim() }) });
    if (res.ok) { const d = await res.json(); setComments(p => [d.comment, ...p]); setText(''); }
    setSending(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-md)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>한줄평</span>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{comments.length}</span>
      </div>
      {userId ? (
        <div style={{ marginBottom: 'var(--sp-md)' }}>
          <div style={{ position: 'relative' }}>
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))} rows={2} maxLength={200} placeholder="이 현장 어때요? (200자)"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', resize: 'none', boxSizing: 'border-box' }} />
            <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{text.length}/200</span>
          </div>
          <button onClick={submit} disabled={sending || !text.trim()} style={{ marginTop: 6, padding: '8px 16px', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', opacity: !text.trim() ? 0.5 : 1 }}>
            {sending ? '등록 중...' : '등록'}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}><a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: 'var(--brand)' }}>로그인</a> 후 한줄평을 남길 수 있어요</div>
      )}
      <div>
        {comments.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>첫 한줄평을 남겨보세요!</div>}
        {comments.map((c: Record<string, any>) => (
          <div key={c.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(c.nickname || '사용자'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {(c.nickname || '사')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.nickname || '사용자'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 3 }}>{c.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
