'use client';
import { useState, useEffect, useRef } from 'react';
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
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 3 * 1024 * 1024) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    setUploadingImage(true);
    try {
      const sb = createSupabaseBrowser();
      const path = `comments/${userId}/${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const { error } = await sb.storage.from('images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      setCommentImage(sb.storage.from('images').getPublicUrl(path).data.publicUrl);
    } catch { /* silent */ }
    finally { setUploadingImage(false); if (e.target) e.target.value = ''; }
  };

  const submit = async () => {
    if ((!text.trim() && !commentImage) || !userId) return;
    setSending(true);
    const body: Record<string, any> = { house_key: houseKey, house_nm: houseNm, house_type: houseType, content: text.trim() || '(사진)' };
    if (commentImage) body.image_url = commentImage;
    const res = await fetch('/api/apt/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { const d = await res.json(); setComments(p => [d.comment, ...p]); setText(''); setCommentImage(null); }
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
          {commentImage && (
            <div style={{ marginBottom: 6, display: 'inline-flex', position: 'relative' }}>
              <img src={commentImage} alt="첨부" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              <button onClick={() => setCommentImage(null)} aria-label="이미지 제거"
                style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: 'var(--text-tertiary)', padding: 0 }}>✕</button>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageUpload} />
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))} rows={2} maxLength={200} placeholder="이 현장 어때요? (200자)"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', resize: 'none', boxSizing: 'border-box' }} />
            <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{text.length}/200</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <button onClick={() => imgRef.current?.click()} disabled={uploadingImage || !!commentImage} type="button" aria-label="사진 첨부"
              style={{ padding: '6px 10px', background: 'var(--bg-hover)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: commentImage ? 'var(--brand)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              사진
            </button>
            <button onClick={submit} disabled={sending || (!text.trim() && !commentImage)} style={{ padding: '6px 16px', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', opacity: (!text.trim() && !commentImage) ? 0.5 : 1 }}>
              {sending || uploadingImage ? '...' : '등록'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}><a href={`/login?redirect=${encodeURIComponent(pathname)}&source=apt_comment`} style={{ color: 'var(--brand)' }}>로그인</a> 후 한줄평을 남길 수 있어요</div>
      )}
      <div>
        {comments.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>첫 한줄평을 남겨보세요!</div>}
        {comments.map((c: Record<string, any>) => (
          <div key={c.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(c.nickname || '사용자'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {(c.nickname || '사')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.nickname || '사용자'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 3 }}>{c.content}</div>
              {c.image_url && (
                <a href={c.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 4 }}>
                  <img src={c.image_url} alt="댓글 이미지" style={{ maxWidth: 140, maxHeight: 100, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border)' }} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
