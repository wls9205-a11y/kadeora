import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface Props {
  slug: string;
}

interface RelatedBlog {
  blog_slug: string;
  title: string;
  sub_category?: string | null;
  cron_type?: string | null;
  cover_image?: string | null;
  view_count?: number | null;
  rn?: number | null;
}

function colorFor(blog: RelatedBlog): { bg: string; label: string } {
  const sub = blog.sub_category || '';
  const cron = blog.cron_type || '';
  if (sub.includes('청약') || cron === 'cheongak' || cron === 'lotto_cheongak') return { bg: '#791F1F', label: '청약' };
  if (cron === 'apt-batch-v3' || sub.includes('실거래')) return { bg: '#854F0B', label: '시세' };
  if (cron === 'issue_preempt' || cron === 'issue-draft') return { bg: '#0C447C', label: '이슈' };
  if (sub.includes('재개발') || sub.includes('재건축') || cron === 'redev-seed') return { bg: '#0F6E56', label: '재개발' };
  if (sub.includes('미분양') || cron === 'unsold-analysis') return { bg: '#3C3489', label: '미분양' };
  if (sub.includes('단지')) return { bg: '#0F6E56', label: '단지분석' };
  return { bg: '#2C2C2A', label: '기사' };
}

export default async function AptBlogStack({ slug }: Props) {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('v_apt_related_blogs')
    .select('blog_slug,title,sub_category,cron_type,cover_image,view_count,rn')
    .eq('apt_slug', slug)
    .lte('rn', 5)
    .order('rn', { ascending: true });

  const blogs = ((data ?? []) as RelatedBlog[]).filter(b => b.blog_slug && b.title);
  if (blogs.length === 0) return null;

  return (
    <section
      aria-label="관련 블로그"
      style={{ margin: '0 0 12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5 }}>관련 블로그</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
          7,961 자산
        </span>
      </div>
      <div
        className="apt-blog-stack"
        style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}
      >
        {blogs.map(b => {
          const c = colorFor(b);
          return (
            <Link
              key={b.blog_slug}
              href={`/blog/${encodeURIComponent(b.blog_slug)}`}
              style={{ flex: '0 0 auto', width: 110, scrollSnapAlign: 'start', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ width: 110, height: 56, borderRadius: 8, background: c.bg, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, letterSpacing: -0.5 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {b.title}
              </div>
              {(b.view_count ?? 0) > 0 && (
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>👀 {b.view_count?.toLocaleString()}</div>
              )}
            </Link>
          );
        })}
      </div>
      <style>{`
        .apt-blog-stack::-webkit-scrollbar { display: none; }
        @media (max-width: 480px) {
          .apt-blog-stack > a { width: 88px !important; }
          .apt-blog-stack > a > div:first-child { width: 88px !important; height: 44px !important; font-size: 10px !important; }
        }
      `}</style>
    </section>
  );
}
