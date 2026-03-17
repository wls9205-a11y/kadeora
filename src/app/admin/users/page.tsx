'use client';
import { useState, useEffect } from 'react';

interface User { id: string; nickname: string; grade_title: string; created_at: string; posts_count: number; is_deleted: boolean }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'active'|'suspended'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) { const d = await res.json(); setUsers(d.users ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const action = async (id: string, act: string) => {
    const msg = act === 'suspend' ? '이 유저를 정지하시겠습니까?' : '이 유저를 복구하시겠습니까?';
    if (!confirm(msg)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    load();
  };

  const filtered = users
    .filter(u => filter === 'all' || (filter === 'active' ? !u.is_deleted : u.is_deleted))
    .filter(u => !search || (u.nickname || '').includes(search));

  const tab = (v: string, l: string) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: filter === v ? 'var(--brand)' : 'var(--bg-hover)',
    color: filter === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>👥 유저 관리</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setFilter('all')} style={tab('all', '전체')}>전체</button>
        <button onClick={() => setFilter('active')} style={tab('active', '정상')}>정상</button>
        <button onClick={() => setFilter('suspended')} style={tab('suspended', '정지됨')}>정지됨</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 검색" style={{
          marginLeft: 'auto', padding: '6px 12px', fontSize: 13, background: 'var(--bg-hover)',
          border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', width: 180,
        }} />
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>닉네임</th>
                <th style={{ padding: '10px 12px' }}>등급</th>
                <th style={{ padding: '10px 12px' }}>가입일</th>
                <th style={{ padding: '10px 12px' }}>게시글</th>
                <th style={{ padding: '10px 12px' }}>상태</th>
                <th style={{ padding: '10px 12px' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.is_deleted ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.nickname || '미설정'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.grade_title || '-'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.posts_count ?? 0}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: u.is_deleted ? 'var(--error)' : 'var(--success)',
                      color: 'var(--text-inverse)' }}>{u.is_deleted ? '정지' : '정상'}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.is_deleted ? (
                      <button onClick={() => action(u.id, 'restore')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer' }}>복구</button>
                    ) : (
                      <button onClick={() => action(u.id, 'suspend')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>정지</button>
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
