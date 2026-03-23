'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { CommentWithProfile } from '@/types/database';
import type { User } from '@supabase/supabase-js';
import ReportButton from '@/components/ReportButton';
import { gradeEmoji, gradeTitle, gradeColor } from '@/lib/constants';
import { timeAgo } from '@/lib/format';

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
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) { error('삭제에 실패했습니다'); return; }
      setComments(prev => prev.filter(c => c.id !== commentId));
      setDeleteTarget(null);
      success('댓글이 삭제되었습니다');
    } catch { error('오류가 발생했습니다'); }
  };

  const handleCommentLike = async (commentId: number, currentLikes: number) => {
    if (!user) { info('로그인이 필요합니다'); return; }
    if (likingIds.has(commentId)) return;
    setLikingIds(prev => new Set(prev).add(commentId));
    // Optimistic update
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: currentLikes + 1 } : c));
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: data.likes_count ?? currentLikes + 1 } : c));
      } else {
        // rollback
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: currentLikes } : c));
      }
    } catch {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: currentLikes } : c));
    } finally {
      setLikingIds(prev => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-md)', fontWeight: 700, margin: '0 0 12px' }}>
        댓글 {comments.length}
      </h3>

      {/* 댓글 입력 — 인라인 (댓글 목록 위) */}
      <div style={{ marginBottom: 16 }}>
        {user ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="댓글을 남겨보세요..."
              maxLength={500}
              rows={2}
              style={{
                flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text-primary)', padding: '10px 14px',
                fontSize: 'var(--fs-base)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            />
            <button onClick={handleSubmit} disabled={loading || !content.trim()} style={{
              padding: '10px 16px', borderRadius: 10, border: 'none', flexShrink: 0,
              background: content.trim() ? 'var(--brand)' : 'var(--bg-hover)',
              color: content.trim() ? 'white' : 'var(--text-tertiary)',
              cursor: content.trim() ? 'pointer' : 'default', fontSize: 'var(--fs-sm)', fontWeight: 700,
            }}>등록</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            <a href="/login" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>로그인</a>하면 댓글을 남길 수 있어요
          </div>
        )}
      </div>

      {/* 댓글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>
            💬 첫 댓글을 남겨보세요
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} style={{ background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-inverse)', flexShrink: 0 }}>
                    {(comment.profiles?.nickname ?? 'U')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{gradeEmoji(comment.profiles?.grade ?? null)} {comment.profiles?.nickname ?? '익명'}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: gradeColor(comment.profiles?.grade ?? null), fontWeight: 600 }}>{gradeTitle(comment.profiles?.grade ?? null)}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(comment.created_at)}</span>
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
                      color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', padding: '2px 6px',
                      borderRadius: 6, transition: 'all 0.15s',
                      opacity: likingIds.has(comment.id) ? 0.5 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    🤍 <span>{comment.likes_count ?? 0}</span>
                  </button>
                  {/* 삭제 버튼 */}
                  {user?.id === comment.author_id && (
                    <button
                      onClick={() => setDeleteTarget(comment.id)}
                      aria-label="댓글 삭제"
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 'var(--fs-sm)', cursor: 'pointer', opacity: 0.7, padding: '2px 4px' }}
                    >삭제</button>
                  )}
                  <ReportButton commentId={comment.id} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{comment.content}</p>
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