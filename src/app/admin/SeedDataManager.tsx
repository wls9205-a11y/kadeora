'use client';
import { useState, useEffect } from 'react';

export default function SeedDataManager() {
  const [stats, setStats] = useState<{ users: number; posts: number; comments: number; likes: number } | null>(null);
  const [deleting, setDeleting] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [result, setResult] = useState('');

  const load = () => {
    fetch('/api/admin/seed-stats').then(r => r.json()).then(setStats).catch(() => {});
  };
  useEffect(load, []);

  const handleDelete = async (target: string) => {
    setDeleting(target); setResult('');
    try {
      const res = await fetch(`/api/admin/seed-delete?target=${target}`, { method: 'DELETE' });
      const data = await res.json();
      setResult(res.ok ? `✅ ${target} 삭제 완료` : `❌ ${data.error}`);
      load();
    } catch { setResult('❌ 삭제 실패'); }
    setDeleting(''); setConfirmAll(false);
  };

  const btn = (target: string, label: string, color: string) => (
    <button key={target} onClick={() => handleDelete(target)} disabled={!!deleting}
      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${color}`, background: 'transparent', color, fontSize: 12, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting === target ? 0.5 : 1 }}>
      {deleting === target ? '삭제중...' : label}
    </button>
  );

  if (!stats) return <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 16 }}>로딩 중...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🧪 시드 데이터 관리</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '시드 유저', value: stats.users, icon: '👤' },
          { label: '시드 게시글', value: stats.posts, icon: '📝' },
          { label: '시드 댓글', value: stats.comments, icon: '💬' },
          { label: '시드 좋아요', value: stats.likes, icon: '❤️' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 16 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {btn('likes', '좋아요 삭제', 'var(--warning)')}
        {btn('comments', '댓글 삭제', 'var(--warning)')}
        {btn('posts', '게시글 삭제', 'var(--error)')}
        {btn('users', '유저 삭제', 'var(--error)')}
      </div>
      {!confirmAll ? (
        <button onClick={() => setConfirmAll(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: '2px solid var(--error)', background: 'transparent', color: 'var(--error)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ⚠️ 전체 일괄 삭제
        </button>
      ) : (
        <button onClick={() => handleDelete('all')} disabled={!!deleting} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {deleting === 'all' ? '삭제 중...' : '🚨 정말 전체 삭제합니다 (되돌릴 수 없음)'}
        </button>
      )}
      {result && <div style={{ fontSize: 12, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)', marginTop: 6 }}>{result}</div>}
    </div>
  );
}
