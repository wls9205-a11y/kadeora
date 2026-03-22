'use client';
import { useState, useEffect } from 'react';

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 12,
  padding: 20,
  border: '1px solid var(--border)',
};

interface User {
  id: string;
  nickname: string;
  grade_title: string;
  created_at: string;
  posts_count: number;
  is_deleted: boolean;
  region_text: string | null;
  points: number | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [userType, setUserType] = useState<'all' | 'real' | 'seed'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const action = async (id: string, act: string) => {
    const msg = act === 'suspend' ? '이 유저를 정지하시겠습니까?' : '이 유저를 복구하시겠습니까?';
    if (!confirm(msg)) return;
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act }),
    });
    load();
  };

  const setPoints = async (id: string, current: number | null) => {
    const val = prompt('새 포인트 값을 입력하세요', String(current ?? 0));
    if (val === null) return;
    const num = Number(val);
    if (isNaN(num)) { alert('숫자를 입력하세요'); return; }
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_points', points: num }),
    });
    load();
  };

  const isSeed = (id: string) => id.startsWith('aaaaaaaa');
  const seedUsers = users.filter(u => isSeed(u.id));
  const realUsersList = users.filter(u => !isSeed(u.id));

  const filtered = users
    .filter(u => userType === 'all' || (userType === 'real' ? !isSeed(u.id) : isSeed(u.id)))
    .filter(u => filter === 'all' || (filter === 'active' ? !u.is_deleted : u.is_deleted))
    .filter(u => !search || (u.nickname || '').includes(search));

  // Grade distribution
  const gradeMap: Record<string, number> = {};
  for (const u of users) {
    const g = u.grade_title || '미설정';
    gradeMap[g] = (gradeMap[g] || 0) + 1;
  }
  const gradeColors: Record<string, string> = {
    '뉴비': '#9DB0C7', '초보자': 'var(--accent-blue)', '주민': 'var(--accent-green)', '터줏대감': 'var(--accent-yellow)',
    '인싸': 'var(--accent-purple)', '핵인싸': 'var(--accent-red)', '미설정': '#CBD5E1',
  };

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: '전체', value: users.length, color: 'var(--text-primary)' },
          { label: '실제 유저', value: realUsersList.length, color: 'var(--accent-green)' },
          { label: '시드', value: seedUsers.length, color: 'var(--text-tertiary)' },
          { label: '정지됨', value: users.filter(u => u.is_deleted).length, color: 'var(--accent-red)' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Grade Distribution Bar */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>등급 분포</div>
        <div style={{ display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-hover)' }}>
          {Object.entries(gradeMap).map(([grade, count]) => {
            const pct = users.length > 0 ? (count / users.length) * 100 : 0;
            if (pct < 1) return null;
            return (
              <div
                key={grade}
                title={`${grade}: ${count}명 (${pct.toFixed(1)}%)`}
                style={{
                  width: `${pct}%`,
                  background: gradeColors[grade] || '#9DB0C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--fs-xs)',
                  color: '#fff',
                  fontWeight: 700,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {pct > 8 ? grade : ''}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {Object.entries(gradeMap).map(([grade, count]) => (
            <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: gradeColors[grade] || '#9DB0C7' }} />
              {grade} ({count})
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'real', 'seed'] as const).map(t => (
          <button key={t} onClick={() => setUserType(t)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700,
            background: userType === t ? '#2563EB' : 'var(--bg-hover)',
            color: userType === t ? '#fff' : 'var(--text-secondary)',
          }}>
            {t === 'all' ? '전체' : t === 'real' ? `실제 (${realUsersList.length})` : `시드 (${seedUsers.length})`}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        {(['all', 'active', 'suspended'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700,
            background: filter === f ? '#2563EB' : 'var(--bg-hover)',
            color: filter === f ? '#fff' : 'var(--text-secondary)',
          }}>
            {{ all: '전체', active: '정상', suspended: '정지됨' }[f]}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 검색"
          style={{
            marginLeft: 'auto', padding: '6px 12px', fontSize: 'var(--fs-sm)', background: 'var(--bg-hover)',
            border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', width: '100%', maxWidth: 180,
          }}
        />
      </div>

      {/* Users Table */}
      <div style={{ ...cardStyle, overflow: 'auto', padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>닉네임</th>
                <th style={{ padding: '10px 14px' }}>등급</th>
                <th style={{ padding: '10px 14px' }}>가입일</th>
                <th style={{ padding: '10px 14px' }}>게시글</th>
                <th style={{ padding: '10px 14px' }}>포인트</th>
                <th style={{ padding: '10px 14px' }}>상태</th>
                <th style={{ padding: '10px 14px' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--bg-hover)', opacity: u.is_deleted ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {u.nickname || '미설정'}
                    {isSeed(u.id) && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 4, padding: '1px 4px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>시드</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{u.grade_title || '-'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-tertiary)' }}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{u.posts_count ?? 0}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{u.points ?? 0}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                      background: u.is_deleted ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)',
                      color: u.is_deleted ? 'var(--accent-red)' : '#059669',
                    }}>{u.is_deleted ? '정지' : '정상'}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {u.is_deleted ? (
                        <button onClick={() => action(u.id, 'restore')} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 6, border: '1px solid #34D399', background: 'transparent', color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 600 }}>복구</button>
                      ) : (
                        <button onClick={() => action(u.id, 'suspend')} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 6, border: '1px solid #F87171', background: 'transparent', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 600 }}>정지</button>
                      )}
                      <button onClick={() => setPoints(u.id, u.points)} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 6, border: '1px solid #60A5FA', background: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}>포인트</button>
                    </div>
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
