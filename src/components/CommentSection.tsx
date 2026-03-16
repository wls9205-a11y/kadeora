'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { CommentWithProfile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface CommentSectionProps {
  postId: number;
  initialComments?: CommentWithProfile[];
}

export function CommentSection({ postId, initialComments = [] }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentWithProfile[]>(initialComments);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [likingIds, setLikingIds] = useState<Set<number>>(new Set());
  const { success, error, info } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!user) { error('로그인이 필요합니다'); return; }
    const trimmed = content.trim();
    if (!trimmed) { error('댓글 내용을 입력해주세요'); return; }
    if (trimmed.length > 500) { error('댓글은 500자 이내로 입력해주세요'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, content: trimmed }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? '댓글 작성 실패'); }
      const { comment } = await res.json();
      setComments(prev => [{ ...comment, profiles: { id: user.id, nickname: comment.nickname ?? '나', avatar_url: null } }, ...prev]);
      setContent('');
      success('댓글이 작성되었습니다');
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : '댓글 작성 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    const sb = createSupabaseBrowser();
    const { error: err } = await sb.from('comments').update({ is_deleted: true }).eq('id', commentId).eq('author_id', user!.id);
    if (err) { error('삭제에 실패했습니다'); return; }
    setComments(prev => prev.filter(c => c.id !== commentId));
    setDeleteTarget(null);
    success('댓글이 삭제되었습니다');
  };

  const handleCommentLike = async (commentId: number, currentLikes: number) => {
    if (!user) { info('로그인이 필요합니다'); return; }
    if (likingIds.has(commentId)) return;
    setLikingIds(prev => new Set(prev).add(commentId));
    // Optimistic update
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: currentLikes + 1 } : c));
    try {
      const sb = createSupabaseBrowser();
      const { error: err } = await sb.from('comments').update({ likes_count: currentLikes + 1 }).eq('id', commentId);
      if (err) {
        // rollback
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: currentLikes } : c));
        error('오류가 발생했습니다');
      }
    } finally {
      setLikingIds(prev => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ color: 'var(--kd-text)', fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>💬</span> 댓글 <span style={{ color: 'var(--kd-primary)', fontSize: 14, fontWeight: 500 }}>{comments.length}</span>
      </h3>

      {/* 댓글 입력 */}
      <div style={{ background: 'var(--kd-surface)', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid var(--kd-border)' }}>
        {user ? (
          <>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="댓글을 작성해주세요... (Ctrl+Enter로 작성)"
              maxLength={500}
              rows={3}
              style={{
                width: '100%', background: 'var(--kd-bg)', border: '1px solid var(--kd-border)',
                borderRadius: 8, color: 'var(--kd-text)', padding: '10px 12px',
                fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--kd-primary)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--kd-border)')}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 12, color: content.length > 450 ? 'var(--kd-danger)' : 'var(--kd-text-dim)' }}>{content.length}/500자</span>
              <button onClick={handleSubmit} disabled={loading || !content.trim()} className="kd-btn kd-btn-primary" style={{ fontSize: 13, padding: '7px 16px' }}>
                {loading ? '작성 중...' : '댓글 작성'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--kd-text-muted)', fontSize: 14 }}>
            <a href="/login" style={{ color: 'var(--kd-primary)', textDecoration: 'none', fontWeight: 600 }}>로그인</a>하시면 댓글을 작성할 수 있습니다
          </div>
        )}
      </div>

      {/* 댓글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--kd-text-dim)', fontSize: 14 }}>
            아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} style={{ background: 'var(--kd-surface)', borderRadius: 10, border: '1px solid var(--kd-border)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--kd-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-inverse)', flexShrink: 0 }}>
                    {(comment.profiles?.nickname ?? 'U')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--kd-text)' }}>{comment.profiles?.nickname ?? '익명'}</span>
                  <span style={{ fontSize: 11, color: 'var(--kd-text-dim)' }}>{timeAgo(comment.created_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* 댓글 좋아요 */}
                  <button
                    onClick={() => handleCommentLike(comment.id, comment.likes_count ?? 0)}
                    disabled={likingIds.has(comment.id)}
                    aria-label="댓글 좋아요"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--kd-text-dim)', fontSize: 12, padding: '2px 6px',
                      borderRadius: 6, transition: 'all 0.15s',
                      opacity: likingIds.has(comment.id) ? 0.5 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--kd-danger)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--kd-text-dim)')}
                  >
                    🤍 <span>{comment.likes_count ?? 0}</span>
                  </button>
                  {/* 삭제 버튼 */}
                  {user?.id === comment.author_id && (
                    <button
                      onClick={() => setDeleteTarget(comment.id)}
                      aria-label="댓글 삭제"
                      style={{ background: 'none', border: 'none', color: 'var(--kd-danger)', fontSize: 12, cursor: 'pointer', opacity: 0.7, padding: '2px 4px' }}
                    >삭제</button>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--kd-text)', lineHeight: 1.6 }}>{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="댓글 삭제"
        message="이 댓글을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => deleteTarget !== null && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}