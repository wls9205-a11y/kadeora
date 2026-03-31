'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { timeAgo } from '@/lib/format';

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
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>✏️ 한줄평 <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 400 }}>{comments.length}</span></div>
      {userId ? (
        <div style={{ marginBottom: 'var(--sp-md)' }}>
          <div style={{ position: 'relative' }}>
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))} rows={2} maxLength={200} placeholder="이 현장 어때요? (200자)"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 'var(--fs-base)', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{text.length}/200</span>
          </div>
          <button onClick={submit} disabled={sending || !text.trim()} style={{ marginTop: 6, padding: '8px 16px', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', opacity: !text.trim() ? 0.5 : 1 }}>
            {sending ? '등록 중...' : '등록'}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}><a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: 'var(--brand)' }}>로그인</a> 후 한줄평을 남길 수 있어요</div>
      )}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {comments.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>첫 한줄평을 남겨보세요! 👋</div>}
        {comments.map((c: Record<string, any>) => (
          <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)' }}>{c.nickname}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
