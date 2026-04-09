import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CATEGORY_LABEL: Record<string, string> = {
  stock: '📈 주식', apt: '🏠 부동산', local: '🏘 우리동네', free: '💬 자유',
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: post } = await sb
    .from('posts')
    .select('title,category,likes_count,profiles!posts_author_id_fkey(nickname)')
    .eq('id', id)
    .maybeSingle();

  const title = post?.title ?? '카더라';
  const nickname = ((post?.profiles as unknown) as { nickname: string } | null)?.nickname ?? '익명';
  const category = CATEGORY_LABEL[post?.category ?? ''] ?? '';
  const likes = post?.likes_count ?? 0;

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630, background: '#050A18',
        display: 'flex', flexDirection: 'column', padding: '60px 80px',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: '#3B7BF6' }} />
            ))}
          </div>
          <span style={{ fontSize: '30px', fontWeight: 800, color: '#3B7BF6' }}>카더라</span>
        </div>

        <div style={{
          fontSize: 48, fontWeight: 800, color: '#E8EDF5', lineHeight: 1.3, flex: 1,
        }}>
          {title.length > 50 ? title.slice(0, 50) + '...' : title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-lg)', marginTop: 32 }}>
          {category && <span style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>{category}</span>}
          <span style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>@{nickname}</span>
          <span style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>❤ {likes}</span>
          <span style={{ marginLeft: 'auto', fontSize: '17px', color: '#7D8DA3' }}>kadeora.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
