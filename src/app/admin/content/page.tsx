'use client';
import { useState, useEffect } from 'react';

interface Post { id: number; title: string; category: string; is_deleted: boolean; created_at: string; likes_count: number; comments_count: number; view_count: number; profiles: { nickname: string } | null }
interface ChatMsg { id: string; content: string; created_at: string; profiles: { nickname: string } | null }

const ITEMS_PER_PAGE = 30;

export default function AdminContentPage() {
  const [mainTab, setMainTab] = useState<'posts' | 'chat'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'hidden'>('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Chat state
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/posts');
    if (res.ok) { const d = await res.json(); setPosts(d.posts ?? []); }
    setLoading(false);
    setSelectedIds(new Set());
  };
  useEffect(() => { load(); }, []);

  const loadChat = async () => {
    setChatLoading(true);
    try {
      const res = await fetch('/api/admin/chat-messages');
      if (res.ok) { const d = await res.json(); setChatMsgs(d.messages ?? []); }
    } catch {}
    setChatLoading(false);
  };

  const deleteChat = async (id: string) => {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
    await fetch('/api/admin/chat-messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setChatMsgs(prev => prev.filter(m => m.id !== id));
  };

  const action = async (id: number, act: string) => {
    if (act === 'hide' && !confirm('이 게시글을 숨김 처리하시겠습니까?')) return;
    await fetch(`/api/admin/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    load();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedPosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedPosts.map(p => p.id)));
    }
  };

  const bulkHide = async () => {
    if (!confirm(`선택한 ${selectedIds.size}개 게시글을 숨김 처리하시겠습니까?`)) return;
    setBulkLoading(true);
    try {
      await fetch('/api/admin/posts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hide', ids: Array.from(selectedIds) }),
      });
      await load();
    } catch {}
    setBulkLoading(false);
  };

  const filtered = posts
    .filter(p => catFilter === 'all' || p.category === catFilter)
    .filter(p => statusFilter === 'all' || (statusFilter === 'active' ? !p.is_deleted : p.is_deleted))
    .filter(p => !search || p.title.includes(search));

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedPosts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [search, catFilter, statusFilter]);

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
    background: active ? 'var(--brand)' : 'var(--bg-hover)',
    color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });
  const pillStyle = (v: string, cur: string) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: cur === v ? 'var(--brand)' : 'var(--bg-hover)',
    color: cur === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>📝 콘텐츠 관리</h1>

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMainTab('posts')} style={tabStyle(mainTab === 'posts')}>게시글</button>
        <button onClick={() => { setMainTab('chat'); if (chatMsgs.length === 0) loadChat(); }} style={tabStyle(mainTab === 'chat')}>채팅</button>
      </div>

      {mainTab === 'posts' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {['all', 'stock', 'apt', 'free'].map(c => <button key={c} onClick={() => setCatFilter(c)} style={pillStyle(c, catFilter)}>{c === 'all' ? '전체' : c}</button>)}
            <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            <button onClick={() => setStatusFilter('all')} style={pillStyle('all', statusFilter)}>전체</button>
            <button onClick={() => setStatusFilter('active')} style={pillStyle('active', statusFilter)}>정상</button>
            <button onClick={() => setStatusFilter('hidden')} style={pillStyle('hidden', statusFilter)}>숨김</button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목 검색" style={{
            width: '100%', padding: '8px 12px', fontSize: 13, background: 'var(--bg-hover)',
            border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', marginBottom: 12, boxSizing: 'border-box',
          }} />

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 10,
              background: 'var(--bg-hover)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedIds.size}개 선택됨
              </span>
              <button
                onClick={bulkHide}
                disabled={bulkLoading}
                style={{
                  fontSize: 12, padding: '5px 14px', borderRadius: 6, border: 'none',
                  background: 'var(--error)', color: '#fff', cursor: bulkLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, opacity: bulkLoading ? 0.6 : 1,
                }}
              >
                {bulkLoading ? '처리 중...' : `선택한 ${selectedIds.size}개 숨기기`}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
                }}
              >
                선택 해제
              </button>
            </div>
          )}

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px', width: 36 }}>
                      <input
                        type="checkbox"
                        checked={paginatedPosts.length > 0 && selectedIds.size === paginatedPosts.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </th>
                    <th style={{ padding: '10px 12px' }}>제목</th><th style={{ padding: '10px 8px' }}>작성자</th>
                    <th style={{ padding: '10px 8px' }}>분류</th><th style={{ padding: '10px 8px' }}>작성일</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>조회</th><th style={{ padding: '10px 8px' }}>상태</th>
                    <th style={{ padding: '10px 8px' }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPosts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: p.is_deleted ? 0.5 : 1, background: selectedIds.has(p.id) ? 'var(--bg-hover)' : 'transparent' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={`/feed/${p.id}`} target="_blank" rel="noopener" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>{p.title}</a>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{p.profiles?.nickname || '-'}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)' }}>{p.category}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)' }}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>{p.view_count}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                          background: p.is_deleted ? 'var(--error)' : 'var(--success)', color: 'var(--text-inverse)' }}>
                          {p.is_deleted ? '숨김' : '정상'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', display: 'flex', gap: 4 }}>
                        {p.is_deleted ? (
                          <button onClick={() => action(p.id, 'restore')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer' }}>복구</button>
                        ) : (
                          <button onClick={() => action(p.id, 'hide')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>숨김</button>
                        )}
                        <button onClick={async () => {
                          if (!confirm('정말 삭제하시겠습니까?')) return;
                          await fetch(`/api/admin/posts/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hide' }) });
                          setPosts(prev => prev.filter(x => x.id !== p.id));
                        }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--error)', color: '#fff', cursor: 'pointer' }}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: currentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-surface)', color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                ← 이전
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: currentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-surface)', color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                다음 →
              </button>
            </div>
          )}
        </>
      )}

      {mainTab === 'chat' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
          {chatLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
          ) : chatMsgs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>채팅 메시지가 없습니다</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>닉네임</th>
                  <th style={{ padding: '10px 8px' }}>내용</th>
                  <th style={{ padding: '10px 8px' }}>시간</th>
                  <th style={{ padding: '10px 8px' }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {chatMsgs.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {(m.profiles as any)?.nickname || '-'}
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.content}
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button onClick={() => deleteChat(m.id)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--error)', color: '#fff', cursor: 'pointer' }}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
