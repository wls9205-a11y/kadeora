'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

export default function BlogCommentInput({ blogPostId }: { blogPostId: number }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();
  const router = useRouter();
  const { userId } = useAuth();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 3 * 1024 * 1024) { error('3MB 이하만 가능'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error('JPG, PNG, WebP만 가능'); return; }
    setUploadingImage(true);
    try {
      const sb = createSupabaseBrowser();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `comments/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('images').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from('images').getPublicUrl(path);
      setCommentImage(publicUrl);
    } catch { error('이미지 업로드 실패'); }
    finally { setUploadingImage(false); if (e.target) e.target.value = ''; }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !commentImage) { error('의견을 입력해주세요'); return; }
    if (trimmed.length > 1000) { error('1000자 이내로 입력해주세요'); return; }
    if (!userId) { error('로그인이 필요합니다'); return; }
    setLoading(true);
    try {
      const sb = createSupabaseBrowser();
      const insertData: Record<string, unknown> = { blog_post_id: blogPostId, author_id: userId, content: trimmed || '(사진)' };
      if (commentImage) insertData.image_url = commentImage;
      const { error: insertErr } = await (sb as any).from('blog_comments').insert(insertData);
      if (insertErr) throw insertErr;
      setContent(''); setCommentImage(null);
      success('의견이 등록되었습니다');
      router.refresh();
    } catch {
      error('등록에 실패했습니다');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom: 'var(--sp-lg)' }}>
      {commentImage && (
        <div style={{ marginBottom: 6, display: 'inline-flex', position: 'relative' }}>
          <img src={commentImage} alt="첨부" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
          <button onClick={() => setCommentImage(null)} aria-label="이미지 제거"
            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: 'var(--text-tertiary)', padding: 0 }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-end' }}>
        <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageUpload} />
        <textarea
          value={content} onChange={e => setContent(e.target.value)} aria-label="댓글 입력"
          placeholder="의견을 남겨보세요..." maxLength={1000} rows={2}
          style={{ flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', color: 'var(--text-primary)', padding: 'var(--sp-md) var(--card-p)', fontSize: 'var(--fs-base)', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        />
        <button onClick={() => imgRef.current?.click()} disabled={uploadingImage || !!commentImage} type="button" aria-label="사진 첨부"
          style={{ padding: '10px', borderRadius: 'var(--radius-card)', border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: commentImage ? 'var(--brand)' : 'var(--text-tertiary)', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        </button>
        <button onClick={handleSubmit} disabled={loading || (!content.trim() && !commentImage)}
          style={{ padding: '10px 16px', borderRadius: 'var(--radius-card)', border: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700, background: (content.trim() || commentImage) ? 'var(--brand)' : 'var(--bg-hover)', color: (content.trim() || commentImage) ? 'white' : 'var(--text-tertiary)', cursor: (content.trim() || commentImage) && !loading ? 'pointer' : 'default', flexShrink: 0 }}>
          {loading || uploadingImage ? '...' : '등록'}
        </button>
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 'var(--sp-xs)' }}>
        {content.length}/1000
      </div>
    </div>
  );
}
