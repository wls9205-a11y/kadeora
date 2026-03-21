import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';

export const revalidate = 300;
export const metadata: Metadata = {
  title: '카더라 블로그 — 주식·청약·부동산 정보',
  description: '코스피 코스닥 시세, 아파트 청약 일정, 미분양 현황, 재테크 정보를 매일 업데이트합니다.',
};

const CATS = [
  { key: 'all', label: '전체' },
  { key: 'stock', label: '주식' },
  { key: 'apt', label: '청약' },
  { key: 'unsold', label: '미분양' },
  { key: 'finance', label: '재테크' },
];

interface Props { searchParams: Promise<{ category?: string }> }

export default async function BlogPage({ searchParams }: Props) {
  const { category = 'all' } = await searchParams;
  const sb = await createSupabaseServer();

  let q = sb.from('blog_posts').select('id, slug, title, excerpt, category, tags, created_at, view_count')
    .eq('is_published', true).order('created_at', { ascending: false }).limit(30);
  if (category !== 'all') q = q.eq('category', category);
  const { data: posts } = await q;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>블로그</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>매일 업데이트되는 투자 정보</p>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {CATS.map(c => (
          <Link key={c.key} href={`/blog${c.key !== 'all' ? `?category=${c.key}` : ''}`}
            style={{
              padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: category === c.key ? 700 : 500,
              background: category === c.key ? 'var(--text-primary)' : 'var(--bg-surface)',
              color: category === c.key ? 'var(--bg-base, #fff)' : 'var(--text-secondary)',
              textDecoration: 'none', flexShrink: 0, border: category === c.key ? 'none' : '1px solid var(--border)',
            }}>
            {c.label}
          </Link>
        ))}
      </div>

      {/* 글 목록 */}
      {(posts ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>아직 블로그 글이 없어요</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(posts ?? []).map((p: any) => (
            <Link key={p.id} href={`/blog/${p.slug}`} style={{ display: 'block', padding: '14px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>{p.title}</div>
              {p.excerpt && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.excerpt}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                {p.view_count > 0 && <span>조회 {p.view_count}</span>}
                {(p.tags ?? []).slice(0, 2).map((t: string) => <span key={t} style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>#{t}</span>)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
