'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface BlogPost { id: number; slug: string; title: string; category: string; cron_type: string | null; view_count: number; created_at: string; is_published: boolean }

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('blog_posts').select('id, slug, title, category, cron_type, view_count, created_at, is_published')
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setPosts(data as BlogPost[] ?? []); setLoading(false); });
  }, []);

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
    } catch { setMsg(`${label} 실패`); }
    setTriggering(null);
  };

  const total = posts.length;
  const published = posts.filter(p => p.is_published).length;
  const totalViews = posts.reduce((s, p) => s + (p.view_count ?? 0), 0);
  const cats = posts.reduce((a, p) => { a[p.category] = (a[p.category] ?? 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>블로그 관리</h1>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '전체', value: total },
          { label: '게시됨', value: published },
          { label: '총 조회', value: totalViews },
          { label: '카테고리', value: Object.keys(cats).length },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{k.value.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 크론 수동 실행 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>크론 수동 실행</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: '주식 시황', ep: '/api/cron/blog-daily' },
            { label: '현장별 블로그', ep: '/api/cron/blog-apt-new' },
            { label: '주간 리포트', ep: '/api/cron/blog-weekly' },
            { label: '월간 리포트', ep: '/api/cron/blog-monthly' },
          ].map(c => (
            <button key={c.label} onClick={() => trigger(c.ep, c.label)} disabled={!!triggering}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: triggering === c.label ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: triggering ? 'not-allowed' : 'pointer' }}>
              {triggering === c.label ? '...' : c.label}
            </button>
          ))}
        </div>
        {msg && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{msg}</div>}
      </div>

      {/* 목록 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>제목</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>카테고리</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>조회</th>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-tertiary)' }}>날짜</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>블로그 글이 없습니다. 크론을 실행하세요.</td></tr>
            ) : posts.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{p.title}</a>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{p.category}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{p.view_count}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
