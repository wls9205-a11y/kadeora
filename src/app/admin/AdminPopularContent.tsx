'use client';
import { useState, useEffect } from 'react';

interface PopularPost {
  id: number;
  title: string;
  category: string;
  view_count: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

interface PopularBlog {
  id: number;
  title: string;
  slug: string;
  category: string;
  view_count: number;
  published_at: string;
}

const CAT_LABELS: Record<string, string> = {
  all: '전체', stock: '주식', apt: '부동산', local: '우리동네', free: '자유',
};
const BLOG_CAT: Record<string, string> = {
  all: '전체', stock: '주식', apt: '부동산', finance: '재테크', unsold: '미분양',
};

export default function AdminPopularContent() {
  const [posts, setPosts] = useState<PopularPost[]>([]);
  const [blogs, setBlogs] = useState<PopularBlog[]>([]);
  const [postCat, setPostCat] = useState('all');
  const [blogCat, setBlogCat] = useState('all');
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetch(`/api/admin/posts?sort=views&limit=10&category=${postCat}&period=${period}`)
      .then(r => r.json()).then(d => setPosts(d.posts || [])).catch(() => {});
    fetch(`/api/admin/blog-popular?limit=10&category=${blogCat}&period=${period}`)
      .then(r => r.json()).then(d => setBlogs(d.blogs || [])).catch(() => {});
  }, [postCat, blogCat, period]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
      {/* 기간 필터 */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginRight: 8 }}>📊 인기 콘텐츠</span>
        {(['7d', '30d', 'all'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
            background: period === p ? 'var(--brand)' : 'var(--bg-hover)', color: period === p ? 'var(--text-inverse)' : 'var(--text-secondary)',
          }}>{p === '7d' ? '7일' : p === '30d' ? '30일' : '전체'}</button>
        ))}
      </div>

      {/* 커뮤니티 인기글 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>💬 커뮤니티 TOP 10</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.entries(CAT_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setPostCat(k)} style={{
                padding: '2px 8px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer',
                background: postCat === k ? 'var(--brand)' : 'transparent', color: postCat === k ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              }}>{v}</button>
            ))}
          </div>
        </div>
        {posts.length === 0 ? <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', padding: 12, textAlign: 'center' }}>데이터 없음</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {posts.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: i < posts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👁 {p.view_count} · ❤ {p.likes_count} · 💬 {p.comments_count}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 블로그 인기글 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>📰 블로그 TOP 10</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.entries(BLOG_CAT).map(([k, v]) => (
              <button key={k} onClick={() => setBlogCat(k)} style={{
                padding: '2px 8px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer',
                background: blogCat === k ? 'var(--brand)' : 'transparent', color: blogCat === k ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              }}>{v}</button>
            ))}
          </div>
        </div>
        {blogs.length === 0 ? <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', padding: 12, textAlign: 'center' }}>데이터 없음</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {blogs.map((b, i) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: i < blogs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: i < 3 ? 'var(--accent-green)' : 'var(--text-tertiary)', minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👁 {b.view_count} · {BLOG_CAT[b.category] || b.category}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fmtDate(b.published_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
