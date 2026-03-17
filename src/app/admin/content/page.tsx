'use client';
import { useState, useEffect } from 'react';

interface Post { id: number; title: string; category: string; is_deleted: boolean; created_at: string; likes_count: number; comments_count: number; view_count: number; profiles: { nickname: string } | null }

export default function AdminContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'hidden'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/posts');
    if (res.ok) { const d = await res.json(); setPosts(d.posts ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const action = async (id: number, act: string) => {
    await fetch(`/api/admin/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    load();
  };

  const filtered = posts
    .filter(p => catFilter === 'all' || p.category === catFilter)
    .filter(p => statusFilter === 'all' || (statusFilter === 'active' ? !p.is_deleted : p.is_deleted))
    .filter(p => !search || p.title.includes(search));

  const cats = ['all', 'stock', 'apt', 'free'];
  const tab = (v: string, cur: string) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: cur === v ? 'var(--brand)' : 'var(--bg-hover)',
    color: cur === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>📝 콘텐츠 관리</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {cats.map(c => <button key={c} onClick={() => setCatFilter(c)} style={tab(c, catFilter)}>{c === 'all' ? '전체' : c}</button>)}
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button onClick={() => setStatusFilter('all')} style={tab('all', statusFilter)}>전체</button>
        <button onClick={() => setStatusFilter('active')} style={tab('active', statusFilter)}>정상</button>
        <button onClick={() => setStatusFilter('hidden')} style={tab('hidden', statusFilter)}>숨김</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목 검색" style={{
        width: '100%', padding: '8px 12px', fontSize: 13, background: 'var(--bg-hover)',
        border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', marginBottom: 12, boxSizing: 'border-box',
      }} />
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>제목</th>
                <th style={{ padding: '10px 8px' }}>작성자</th>
                <th style={{ padding: '10px 8px' }}>분류</th>
                <th style={{ padding: '10px 8px' }}>작성일</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>조회</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>좋아요</th>
                <th style={{ padding: '10px 8px' }}>상태</th>
                <th style={{ padding: '10px 8px' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: p.is_deleted ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={`/feed/${p.id}`} target="_blank" rel="noopener" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>{p.title}</a>
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{p.profiles?.nickname || '-'}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)' }}>{p.category}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)' }}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>{p.view_count}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>{p.likes_count}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: p.is_deleted ? 'var(--error)' : 'var(--success)', color: 'var(--text-inverse)' }}>
                      {p.is_deleted ? '숨김' : '정상'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {p.is_deleted ? (
                      <button onClick={() => action(p.id, 'restore')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer' }}>복구</button>
                    ) : (
                      <button onClick={() => action(p.id, 'hide')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>숨김</button>
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
