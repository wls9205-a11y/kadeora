'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';

interface Props {
  postId: number;
  authorId: string;
  currentUserId: string | null;
}

export default function PostActions({ postId, authorId, currentUserId }: Props) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { success, error } = useToast();

  if (!currentUserId || currentUserId !== authorId) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error('삭제 실패');
      success('게시글이 삭제되었습니다');
      router.push('/feed');
      router.refresh();
    } catch {
      error('삭제 중 오류가 발생했습니다');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => router.push(`/write?edit=${postId}`)}
          style={{
            padding: '5px 12px', borderRadius: 7,
            background: 'transparent', border: '1px solid #1E293B',
            color: '#94A3B8', fontSize: 12, cursor: 'pointer',
          }}
        >수정</button>
        <button
          onClick={() => setShowDelete(true)}
          disabled={deleting}
          style={{
            padding: '5px 12px', borderRadius: 7,
            background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
            color: '#EF4444', fontSize: 12, cursor: 'pointer',
          }}
        >삭제</button>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        title="게시글 삭제"
        message="이 게시글을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}
