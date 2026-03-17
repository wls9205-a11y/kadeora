import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CATEGORY_LABEL: Record<string, string> = {
  stock: '📈 주식', apt: '🏠 부동산', local: '🏘 우리동네', free: '💬 자유',
};

export default async function Image({ params }: { params: { id: string } }) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: post } = await sb
    .from('posts')
    .select('title,category,likes_count,profiles!posts_author_id_fkey(nickname)')
    .eq('id', params.id)
    .single();

  const title = post?.title ?? '카더라';
  const nickname = (post?.profiles as any)?.nickname ?? '익명';
  const category = CATEGORY_LABEL[post?.category ?? ''] ?? '';
  const likes = post?.likes_count ?? 0;

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630, background: '#0d1117',
        display: 'flex', flexDirection: 'column', padding: '60px 80px',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: '#FF4500' }} />
            ))}
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#FF4500' }}>카더라</span>
        </div>

        <div style={{
          fontSize: 48, fontWeight: 800, color: '#e6edf3', lineHeight: 1.3, flex: 1,
        }}>
          {title.length > 50 ? title.slice(0, 50) + '...' : title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
          {category && <span style={{ fontSize: 18, color: '#8b949e' }}>{category}</span>}
          <span style={{ fontSize: 18, color: '#8b949e' }}>@{nickname}</span>
          <span style={{ fontSize: 18, color: '#8b949e' }}>❤ {likes}</span>
          <span style={{ marginLeft: 'auto', fontSize: 16, color: '#6e7681' }}>kadeora.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
