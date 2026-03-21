'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
interface BlogPost { id: number; slug: string; title: string; category: string; cron_type: string | null; view_count: number; created_at: string; is_published: boolean; content_length?: number }

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const sb = createSupabaseBrowser();
    const { data } = await sb.from('blog_posts')
      .select('id, slug, title, category, cron_type, view_count, created_at, is_published, content')
      .order('created_at', { ascending: false }).limit(200);
    setPosts((data ?? []).map((p: any) => ({ ...p, content_length: p.content?.length ?? 0, content: undefined })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const trigger = async (endpoint: string, label: string) => {
    setTriggering(label); setMsg('');
    const sb = createSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token ?? '';
    try {
      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint }),
      });
      const d = await res.json();
      setMsg(`${label}: ${d.created ?? d.status ?? 'done'}`);
      load();
    } catch { setMsg(`${label} 실패`); }
    setTriggering(null);
  };

  const deletePost = async (id: number) => {
    if (!confirm('이 블로그 글을 삭제하시겠습니까?')) return;
    const sb = createSupabaseBrowser();
    await sb.from('blog_posts').delete().eq('id', id);
    setPosts(p => p.filter(x => x.id !== id));
    setMsg('삭제됨');
  };

  const resetAll = async () => {
    if (!confirm('모든 블로그 글을 삭제하고 재생성합니다. 계속하시겠습니까?')) return;
    setTriggering('초기화'); setMsg('삭제 중...');
    const sb = createSupabaseBrowser();
    await sb.from('blog_comments').delete().neq('id', 0);
    await sb.from('blog_posts').delete().neq('id', 0);
    setMsg('재생성 중...');
    for (const ep of ['/api/cron/blog-apt-new', '/api/cron/blog-daily', '/api/cron/blog-weekly', '/api/cron/blog-monthly']) {
      const { data } = await sb.auth.getSession();
      await fetch('/api/admin/trigger-cron', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ endpoint: ep }),
      });
    }
    setMsg('초기화 완료!');
    setTriggering(null);
    load();
  };

  const filtered = catFilter === 'all' ? posts : posts.filter(p => p.category === catFilter);
  const total = posts.length;
  const todayCount = posts.filter(p => p.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const avgLen = total > 0 ? Math.round(posts.reduce((s, p) => s + (p.content_length ?? 0), 0) / total) : 0;
  const totalViews = posts.reduce((s, p) => s + (p.view_count ?? 0), 0);
  const cats = [...new Set(posts.map(p => p.category))].sort();

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>블로그 관리</h1>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '총 글', value: total, sub: `오늘 +${todayCount}` },
          { label: '평균 길이', value: `${avgLen.toLocaleString()}자`, sub: avgLen >= 1500 ? '목표 달성' : '1500자 미달', color: avgLen >= 1500 ? '#10b981' : '#ef4444' },
          { label: '총 조회', value: totalViews.toLocaleString() },
          { label: '카테고리', value: cats.length },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: (k as any).color ?? 'var(--text-primary)' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k.label}</div>
            {(k as any).sub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{(k as any).sub}</div>}
          </div>
        ))}
      </div>

      {/* 크론 + 초기화 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>크론 수동 실행</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: '현장별', ep: '/api/cron/blog-apt-new' },
            { label: '주식 시황', ep: '/api/cron/blog-daily' },
            { label: '주간', ep: '/api/cron/blog-weekly' },
            { label: '월간', ep: '/api/cron/blog-monthly' },
          ].map(c => (
            <button key={c.label} onClick={() => trigger(c.ep, c.label)} disabled={!!triggering}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: triggering ? 'not-allowed' : 'pointer' }}>
              {triggering === c.label ? '...' : c.label}
            </button>
          ))}
          <button onClick={resetAll} disabled={!!triggering}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: triggering ? 'not-allowed' : 'pointer', marginLeft: 'auto' }}>
            {triggering === '초기화' ? '초기화 중...' : '전체 초기화'}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{msg}</div>}
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setCatFilter('all')} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: catFilter === 'all' ? 700 : 500, background: catFilter === 'all' ? 'var(--text-primary)' : 'var(--bg-hover)', color: catFilter === 'all' ? 'var(--bg-base)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>전체 ({total})</button>
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: catFilter === c ? 700 : 500, background: catFilter === c ? 'var(--text-primary)' : 'var(--bg-hover)', color: catFilter === c ? 'var(--bg-base)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>{c} ({posts.filter(p => p.category === c).length})</button>
        ))}
      </div>

      {/* 목록 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>제목</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>분류</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>글자</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>조회</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>날짜</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>블로그 글이 없습니다</td></tr>
            ) : filtered.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                <td style={{ padding: '10px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>{p.title}</a>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{p.category}</td>
                <td style={{ padding: '10px 12px', color: (p.content_length ?? 0) >= 1500 ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: 700 }}>{(p.content_length ?? 0).toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', fontSize: 11 }}>{p.view_count}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => deletePost(p.id)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
