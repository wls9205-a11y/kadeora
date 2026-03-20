'use client';
import { useState, useEffect } from 'react';

interface User { id: string; nickname: string; grade_title: string; created_at: string; posts_count: number; is_deleted: boolean; region_text: string | null; points: number | null }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'active'|'suspended'>('all');
  const [userType, setUserType] = useState<'all'|'real'|'seed'>('all');
  const [regionFilter, setRegionFilter] = useState('all');
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

  const setPoints = async (id: string, current: number | null) => {
    const val = prompt('새 포인트 값을 입력하세요', String(current ?? 0));
    if (val === null) return;
    const num = Number(val);
    if (isNaN(num)) { alert('숫자를 입력하세요'); return; }
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_points', points: num }) });
    load();
  };

  const regions = Array.from(new Set(users.map(u => u.region_text).filter(Boolean) as string[])).sort();
  const totalUsers = users.length;
  const regionSetCount = users.filter(u => u.region_text).length;
  const regionUnsetCount = totalUsers - regionSetCount;
  const regionPct = totalUsers > 0 ? Math.round((regionSetCount / totalUsers) * 100) : 0;

  const isSeed = (id: string) => id.startsWith('aaaaaaaa');
  const seedUsers = users.filter(u => isSeed(u.id));
  const realUsersList = users.filter(u => !isSeed(u.id));

  const filtered = users
    .filter(u => userType === 'all' || (userType === 'real' ? !isSeed(u.id) : isSeed(u.id)))
    .filter(u => filter === 'all' || (filter === 'active' ? !u.is_deleted : u.is_deleted))
    .filter(u => regionFilter === 'all' || u.region_text === regionFilter)
    .filter(u => !search || (u.nickname || '').includes(search));

  const tab = (v: string, l: string) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: filter === v ? 'var(--brand)' : 'var(--bg-hover)',
    color: filter === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>유저 관리</h1>
      {/* 유저 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{totalUsers}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>전체</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{realUsersList.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>실제 유저</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-tertiary)' }}>{seedUsers.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>시드</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{regionSetCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>지역 설정 {regionPct}%</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 유저 타입 필터 */}
        {(['all', 'real', 'seed'] as const).map(t => (
          <button key={t} onClick={() => setUserType(t)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: userType === t ? 'var(--brand)' : 'var(--bg-hover)',
            color: userType === t ? 'var(--text-inverse)' : 'var(--text-secondary)',
          }}>{t === 'all' ? '전체' : t === 'real' ? `실제 (${realUsersList.length})` : `시드 (${seedUsers.length})`}</button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <button onClick={() => setFilter('all')} style={tab('all', '전체')}>전체</button>
        <button onClick={() => setFilter('active')} style={tab('active', '정상')}>정상</button>
        <button onClick={() => setFilter('suspended')} style={tab('suspended', '정지됨')}>정지됨</button>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{
          padding: '6px 10px', fontSize: 12, background: 'var(--bg-hover)',
          border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <option value="all">지역: 전체</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 검색" style={{
          marginLeft: 'auto', padding: '6px 12px', fontSize: 13, background: 'var(--bg-hover)',
          border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', width: '100%', maxWidth: 180, boxSizing: 'border-box' as const,
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
                <th style={{ padding: '10px 12px' }}>지역</th>
                <th style={{ padding: '10px 12px' }}>가입일</th>
                <th style={{ padding: '10px 12px' }}>게시글</th>
                <th style={{ padding: '10px 12px' }}>포인트</th>
                <th style={{ padding: '10px 12px' }}>상태</th>
                <th style={{ padding: '10px 12px' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.is_deleted ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.nickname || '미설정'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.grade_title || '-'}</td>
                  <td style={{ padding: '10px 12px', color: u.region_text ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{u.region_text || '미설정'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.posts_count ?? 0}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.points ?? 0}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: u.is_deleted ? 'var(--error)' : 'var(--success)',
                      color: 'var(--text-inverse)' }}>{u.is_deleted ? '정지' : '정상'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', display: 'flex', gap: 4 }}>
                    {u.is_deleted ? (
                      <button onClick={() => action(u.id, 'restore')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer' }}>복구</button>
                    ) : (
                      <button onClick={() => action(u.id, 'suspend')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>정지</button>
                    )}
                    <button onClick={() => setPoints(u.id, u.points)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--brand)', background: 'transparent', color: 'var(--brand)', cursor: 'pointer' }}>포인트 수정</button>
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
