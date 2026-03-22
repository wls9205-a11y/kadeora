'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

export default function PostActions({ postId, isOwner }: { postId: number; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { success, error } = useToast();

  if (!isOwner) return null;

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) { success('삭제되었어요'); router.push('/feed'); }
      else error('삭제에 실패했어요');
    } catch { error('오류가 발생했어요'); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xl)', padding: '4px 8px' }}>⋯</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', minWidth: 120, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <button onClick={() => { router.push(`/write?edit=${postId}`); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: 'var(--text-primary)', textAlign: 'left' }}>✏️ 수정</button>
          <button onClick={() => { handleDelete(); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-base)', color: '#F87171', textAlign: 'left', borderTop: '1px solid var(--border)' }}>🗑️ 삭제</button>
        </div>
      )}
    </div>
  );
}
