'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, Pill, Spinner, ago } from '../admin-shared';

export default function ContentSection() {
  const [tab, setTab] = useState<'posts' | 'comments' | 'discuss' | 'chat'>('posts');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback((t = tab, p = 1) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=content&tab=${t}&page=${p}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(tab, 1); setPage(1); }, [tab]); // eslint-disable-line

  const deletePost = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/admin/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_deleted: true }) });
    load(tab, page);
  };

  const pinPost = async (id: number, currentPin: boolean) => {
    await fetch('/api/admin/pin-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: id, pin: !currentPin }) });
    load(tab, page);
  };

  const deleteComment = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/admin/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_deleted: true }) });
    load(tab, page);
  };

  const tabs = [
    { key: 'posts' as const, label: '게시글', icon: '📝' },
    { key: 'comments' as const, label: '댓글', icon: '💬' },
    { key: 'discuss' as const, label: '토론', icon: '🗳️' },
    { key: 'chat' as const, label: '채팅', icon: '💭' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 12px' }}>📝 콘텐츠 관리</h1>

      {/* KPI 요약 */}
      {data && !loading && (
        <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: C.textDim }}>📝 게시글</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.brand }}>{data?.totalPosts ?? '—'}</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: C.textDim }}>💬 댓글</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{data?.totalComments ?? '—'}</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: C.textDim }}>🗳️ 토론</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{data?.totalDiscussions ?? '—'}</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: C.textDim }}>💭 채팅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.cyan }}>{data?.totalMessages ?? '—'}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map(t => <Pill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.icon} {t.label}</Pill>)}
      </div>

      {loading ? <Spinner /> : (
        <>
          {tab === 'posts' && (
            <DataTable
              headers={['제목', '카테고리', '작성자', '조회', '좋아요', '댓글', '작성일', '핀', '삭제']}
              rows={(data?.posts ?? []).map((p: Record<string, any>) => [
                <span key="t" style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{p.is_pinned ? '📌 ' : ''}{p.title || '(제목 없음)'}</span>,
                <Badge key="c" color={C.cyan}>{p.category}</Badge>,
                p.profiles?.nickname || '—',
                p.view_count || 0,
                p.likes_count || 0,
                p.comments_count || 0,
                ago(p.created_at),
                <button key="pin" onClick={() => pinPost(p.id, p.is_pinned)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: p.is_pinned ? C.yellow : C.brandBg, color: p.is_pinned ? C.textInv : C.brand, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>{p.is_pinned ? '📌 해제' : '📌 고정'}</button>,
                p.is_deleted ? <Badge key="d" color={C.red}>삭제됨</Badge> : <button key="del" onClick={() => deletePost(p.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>삭제</button>,
              ])}
            />
          )}
          {tab === 'comments' && (
            <DataTable
              headers={['내용', '작성자', '작성일', '삭제']}
              rows={(data?.comments ?? []).map((c: Record<string, any>) => [
                <span key="co" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', whiteSpace: 'nowrap' }}>{c.content}</span>,
                c.profiles?.nickname || '—',
                ago(c.created_at),
                c.is_deleted ? <Badge key="d" color={C.red}>삭제됨</Badge> : <button key="del" onClick={() => deleteComment(c.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>삭제</button>,
              ])}
            />
          )}
          {tab === 'discuss' && (
            <DataTable
              headers={['제목', '카테고리', 'A vs B', '투표', '댓글', '조회', '🔥', '작성일']}
              rows={(data?.discussions ?? []).map((d: Record<string, any>) => [
                d.title,
                <Badge key="c" color={C.purple}>{d.category}</Badge>,
                `${d.option_a} vs ${d.option_b}`,
                (d.vote_a || 0) + (d.vote_b || 0),
                d.comment_count || 0,
                d.view_count || 0,
                d.is_hot ? '🔥' : '',
                ago(d.created_at),
              ])}
            />
          )}
          {tab === 'chat' && (
            <DataTable
              headers={['내용', '작성자', '시간']}
              rows={(data?.messages ?? []).map((m: Record<string, any>) => [
                <span key="co" style={{ maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{m.content}</span>,
                m.profiles?.nickname || '—',
                ago(m.created_at),
              ])}
            />
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// ✍️ BLOG
// ══════════════════════════════════════
