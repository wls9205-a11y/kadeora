'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface LikeButtonProps {
  postId: number;
  initialCount: number;
  initialLiked?: boolean;
}

export function LikeButton({ postId, initialCount, initialLiked = false }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState<number>(Number(initialCount) || 0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: like } = await sb.from('post_likes')
          .select('id').eq('post_id', postId).eq('user_id', uid).maybeSingle();
        setLiked(!!like);
      }
    });
  }, [postId]);

  const toggle = async () => {
    try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {}
    if (!userId) return;
    if (loading) return;
    setLoading(true);

    const prevLiked = liked;
    const prevCount = count;

    // 낙관적 업데이트만 (서버 count 직접 수정 안함)
    setLiked(!liked);
    setCount(c => liked ? Math.max(0, (c ?? 0) - 1) : (c ?? 0) + 1);

    try {
      const sb = createSupabaseBrowser();
      if (!liked) {
        const { error } = await sb.from('post_likes').insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
      aria-pressed={liked}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 12px', borderRadius: 20,
        background: liked ? 'var(--brand-light)' : 'var(--bg-hover)',
        border: `1px solid ${liked ? 'var(--brand)' : 'var(--border)'}`,
        color: liked ? 'var(--brand)' : 'var(--text-secondary)',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        fontSize: 13, fontWeight: 600,
        opacity: loading ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{liked ? '❤️' : '🤍'}</span>
      <span>{(count ?? 0).toLocaleString()}</span>
    </button>
  );
}
