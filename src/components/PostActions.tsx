'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

interface PostActionsProps {
  postId: number;
  isOwner: boolean;
  isAdmin?: boolean;
}

export default function PostActions({ postId, isOwner, isAdmin }: PostActionsProps) {
  const [open, setOpen] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const router = useRouter();
  const { success, error } = useToast();

  if (!isOwner && !isAdmin) return null;

  const handleDelete = async (adminReason?: string) => {
    if (!isAdmin && !confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        ...(isAdmin && !isOwner ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: adminReason || '관리자 삭제' }),
        } : {}),
      });
      if (res.ok) { success(isAdmin && !isOwner ? '관리자 권한으로 삭제했어요' : '삭제되었어요'); router.push('/feed'); }
      else {
        const data = await res.json().catch(() => ({}));
        error(data?.error || '삭제에 실패했어요');
      }
    } catch { error('오류가 발생했어요'); }
  };

  const handleAdminDelete = () => {
    if (isAdmin && !isOwner) {
      setShowReasonModal(true);
      setOpen(false);
    } else {
      handleDelete();
      setOpen(false);
    }
  };

  const finalReason = reason === '기타' ? (detail || '기타') : (reason ? `${reason}${detail ? ` - ${detail}` : ''}` : (detail || '관리자 삭제'));

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xl)', padding: '4px 8px' }} aria-label="더보기">⋯</button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
            <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', minWidth: 140, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              {isOwner && (
                <button onClick={() => { router.push(`/write?edit=${postId}`); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: 'var(--text-primary)', textAlign: 'left' }}>✏️ 수정</button>
              )}
              <button onClick={handleAdminDelete} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: 'var(--accent-red)', textAlign: 'left', borderTop: isOwner ? '1px solid var(--border)' : 'none' }}>
                🗑️ {isAdmin && !isOwner ? '관리자 삭제' : '삭제'}
              </button>
              {isAdmin && !isOwner && (
                <button onClick={() => { router.push(`/write?edit=${postId}`); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', textAlign: 'left', borderTop: '1px solid var(--border)' }}>⚙️ 관리자 수정</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 관리자 삭제 사유 모달 */}
      {showReasonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowReasonModal(false)}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', padding: 24, maxWidth: 400, width: '100%', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>🛡️ 관리자 게시글 삭제</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>삭제 사유를 입력해 주세요 (로그에 기록됩니다)</div>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 14, marginBottom: 8, outline: 'none' }}
            >
              <option value="">사유 선택</option>
              <option value="스팸/광고">스팸/광고</option>
              <option value="욕설/비방">욕설/비방</option>
              <option value="허위정보">허위정보</option>
              <option value="도배">도배</option>
              <option value="불법 콘텐츠">불법 콘텐츠</option>
              <option value="기타">기타</option>
            </select>
            <input
              type="text"
              placeholder="상세 사유 (선택)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReasonModal(false)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>취소</button>
              <button onClick={() => { setShowReasonModal(false); handleDelete(finalReason); }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-red)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
