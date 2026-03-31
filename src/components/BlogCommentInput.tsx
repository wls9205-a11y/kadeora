'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

export default function BlogCommentInput({ blogPostId }: { blogPostId: number }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();
  const router = useRouter();
  const { userId } = useAuth();

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) { error('의견을 입력해주세요'); return; }
    if (trimmed.length > 1000) { error('1000자 이내로 입력해주세요'); return; }
    if (!userId) { error('로그인이 필요합니다'); return; }
    setLoading(true);
    try {
      const sb = createSupabaseBrowser();
      const { error: insertErr } = await sb.from('blog_comments').insert({
        blog_post_id: blogPostId, author_id: userId, content: trimmed,
      });
      if (insertErr) throw insertErr;
      setContent('');
      success('의견이 등록되었습니다');
      router.refresh();
    } catch {
      error('등록에 실패했습니다');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom: 'var(--sp-lg)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-end' }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          aria-label="댓글 입력"
          placeholder="의견을 남겨보세요..."
          maxLength={1000}
          rows={2}
          style={{
            flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', color: 'var(--text-primary)', padding: 'var(--sp-md) var(--card-p)',
            fontSize: 'var(--fs-base)', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        />
        <button onClick={handleSubmit} disabled={loading || !content.trim()}
          style={{
            padding: '10px 16px', borderRadius: 'var(--radius-card)', border: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700,
            background: content.trim() ? 'var(--brand)' : 'var(--bg-hover)',
            color: content.trim() ? 'white' : 'var(--text-tertiary)',
            cursor: content.trim() && !loading ? 'pointer' : 'default', flexShrink: 0,
          }}>
          {loading ? '...' : '등록'}
        </button>
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 'var(--sp-xs)' }}>
        {content.length}/1000
      </div>
    </div>
  );
}
