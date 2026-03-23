import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: '블로그 시리즈',
  description: '카더라 블로그 시리즈 — 주제별로 엮인 연재 콘텐츠',
};

export const revalidate = 3600;

export default async function BlogSeriesPage() {
  let seriesList: any[] = [];
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sb.from('blog_series')
      .select('*').eq('is_active', true)
      .order('post_count', { ascending: false });
    seriesList = data || [];
  } catch { }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/blog" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 블로그</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📚 시리즈</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>주제별로 묶어서 읽는 연재 콘텐츠</p>
      </div>

      {seriesList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
          <BookOpen size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 'var(--fs-sm)' }}>아직 시리즈가 없습니다</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {seriesList.map(s => (
            <Link key={s.id} href={`/blog/series/${s.slug}`} className="kd-card-hover" style={{
              display: 'block', textDecoration: 'none',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {s.cover_image && (
                  <img src={s.cover_image} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{s.title}</h2>
                  {s.description && (
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                      {s.post_count}편
                    </span>
                    <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>
                      {s.category}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
