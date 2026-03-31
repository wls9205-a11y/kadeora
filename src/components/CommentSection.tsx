'use client';
import { errMsg } from '@/lib/error-utils';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useAuth } from '@/components/AuthProvider';
import type { CommentWithProfile } from '@/types/database';
import ReportButton from '@/components/ReportButton';
import { gradeEmoji, gradeTitle, gradeColor } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { timeAgo } from '@/lib/format';

interface CommentSectionProps {
  postId: number;
  initialComments?: CommentWithProfile[];
}

export function CommentSection({ postId, initialComments = [] }: CommentSectionProps) {
  const pathname = usePathname();
  const [comments, setComments] = useState<CommentWithProfile[]>(initialComments);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { userId } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [likingIds, setLikingIds] = useState<Set<number>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: number; nickname: string } | null>(null);
  const { success, error, info } = useToast();

  const handleSubmit = async () => {
    if (!userId) { error('로그인이 필요합니다'); return; }
    const trimmed = content.trim();
    if (!trimmed) { error('댓글 내용을 입력해주세요'); return; }
    if (trimmed.length > 500) { error('댓글은 500자 이내로 입력해주세요'); return; }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { post_id: postId, content: trimmed };
      if (replyTo) body.parent_id = replyTo.id;
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? '댓글 작성 실패'); }
      const { comment } = await res.json();
      setComments(prev => [{ ...comment, profiles: { id: userId!, nickname: comment.nickname ?? '나', avatar_url: null } }, ...prev]);
      setContent('');
      setReplyTo(null);
      success(replyTo ? '답글이 작성되었습니다' : '댓글이 작성되었습니다');
    } catch (e: unknown) {
      error(e instanceof Error ? errMsg(e) : '댓글 작성 중 오류가 발생했습니다');
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
    if (!userId) { info('로그인이 필요합니다'); return; }
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
    <div style={{ marginTop: 'var(--sp-sm)' }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-md)', fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        💬 대화 {comments.length > 0 && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 500 }}>{comments.length}개</span>}
      </h3>

      {/* 댓글 입력 — 채팅 스타일 */}
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        {replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 10px', background: 'rgba(37,99,235,0.06)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--brand)' }}>
            ↩ <strong>{replyTo.nickname}</strong>에게 답글
            <button onClick={() => setReplyTo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
          </div>
        )}
        {userId ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-inverse)', flexShrink: 0, marginTop: 'var(--sp-xs)' }}>나</div>
            <div style={{ flex: 1 }}>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="여기에 의견을 남겨보세요..."
                maxLength={500}
                rows={2}
                style={{
                  width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', padding: 'var(--sp-md) var(--card-p)',
                  fontSize: 16, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{content.length}/500</span>
                <button onClick={handleSubmit} disabled={loading || !content.trim()} style={{
                  padding: '6px 18px', borderRadius: 'var(--radius-xl)', border: 'none',
                  background: content.trim() ? 'var(--brand)' : 'var(--bg-hover)',
                  color: content.trim() ? 'white' : 'var(--text-tertiary)',
                  cursor: content.trim() ? 'pointer' : 'default', fontSize: 'var(--fs-xs)', fontWeight: 700,
                  transition: 'all var(--transition-fast)',
                }}>등록</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            💬 <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>로그인</a>하고 대화에 참여하세요
          </div>
        )}
      </div>

      {/* 댓글 목록 — 대화 스레드 (대댓글 지원) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
            아직 대화가 없어요. 첫 의견을 남겨보세요!
          </div>
        ) : (() => {
          const rootComments = comments.filter(c => !c.parent_id);
          const replyMap = new Map<number, CommentWithProfile[]>();
          comments.filter(c => c.parent_id).forEach(r => {
            const pid = r.parent_id as number;
            if (!replyMap.has(pid)) replyMap.set(pid, []);
            replyMap.get(pid)!.push(r);
          });

          const renderComment = (comment: CommentWithProfile, isReply = false) => (
            <div key={comment.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', marginLeft: isReply ? 42 : 0 }}>
              <Link href={`/profile/${comment.profiles?.id || comment.author_id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{ width: isReply ? 26 : 32, height: isReply ? 26 : 32, borderRadius: '50%', background: getAvatarColor(comment.profiles?.nickname ?? 'U'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isReply ? 10 : 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-inverse)' }}>
                  {(comment.profiles?.nickname ?? 'U')[0].toUpperCase()}
                </div>
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: isReply ? 'var(--bg-hover)' : 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: isReply ? '4px 12px 12px 12px' : '4px 14px 14px 14px', padding: 'var(--sp-md) var(--card-p)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>{comment.profiles?.nickname ?? '익명'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: gradeColor(comment.profiles?.grade ?? null) }}>{gradeEmoji(comment.profiles?.grade ?? null)} {gradeTitle(comment.profiles?.grade ?? null)}</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.55, wordBreak: 'break-word' }}>{comment.content}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', marginTop: 'var(--sp-xs)', paddingLeft: 4 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(comment.created_at)}</span>
                  <button onClick={() => handleCommentLike(comment.id, comment.likes_count ?? 0)} disabled={likingIds.has(comment.id)} aria-label="좋아요"
                    style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', padding: 0, opacity: likingIds.has(comment.id) ? 0.5 : 1 }}>
                    ♡ {(comment.likes_count ?? 0) > 0 ? comment.likes_count : ''}
                  </button>
                  {!isReply && userId && (
                    <button onClick={() => setReplyTo({ id: comment.id, nickname: comment.profiles?.nickname ?? '익명' })}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>답글</button>
                  )}
                  {userId === comment.author_id && (
                    <button onClick={() => setDeleteTarget(comment.id)} aria-label="삭제"
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: 0 }}>삭제</button>
                  )}
                  <ReportButton commentId={comment.id} />
                </div>
              </div>
            </div>
          );

          return rootComments.map(c => (
            <div key={c.id}>
              {renderComment(c)}
              {(replyMap.get(c.id) || []).map(r => renderComment(r, true))}
            </div>
          ));
        })()}
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