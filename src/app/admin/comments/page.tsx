'use client';
import { useState, useEffect } from 'react';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  is_deleted: boolean;
  author_nickname: string;
  post_title: string;
  post_id: number;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/comments');
    if (res.ok) { const d = await res.json(); setComments(d.comments ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const deleteComment = async (id: number) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    await fetch(`/api/admin/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_deleted: true }) });
    load();
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>💬 댓글 관리</h1>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>내용</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>작성자</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>게시글</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>작성일</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {comments.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', opacity: c.is_deleted ? 0.4 : 1 }}>
                  <td style={{ padding: '10px 14px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{c.content}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{c.author_nickname || '-'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <a href={`/feed/${c.post_id}`} target="_blank" rel="noopener" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12 }}>{(c.post_title || '').slice(0, 30)}</a>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {!c.is_deleted && (
                      <button onClick={() => deleteComment(c.id)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}>삭제</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
