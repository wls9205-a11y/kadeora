'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

interface LikeButtonProps {
  postId: number;
  initialCount: number;
  initialLiked?: boolean;
}

export function LikeButton({ postId, initialCount, initialLiked = false }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { error, info } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: like } = await sb
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', uid)
          .maybeSingle();
        setLiked(!!like);
      }
    });
  }, [postId]);

  const toggle = async () => {
    if (!userId) { info('로그인이 필요합니다'); return; }
    if (loading) return;
    setLoading(true);

    const sb = createSupabaseBrowser();
    const prevLiked = liked;
    const prevCount = count;

    // Optimistic update
    setLiked(!liked);
    setCount(c => liked ? c - 1 : c + 1);

    try {
      if (!liked) {
        const { error: err } = await sb.from('post_likes').insert({ post_id: postId, user_id: userId });
        if (err) throw err;
        await sb.from('posts').update({ likes_count: count + 1 }).eq('id', postId);
      } else {
        const { error: err } = await sb.from('post_likes')
          .delete().eq('post_id', postId).eq('user_id', userId);
        if (err) throw err;
        await sb.from('posts').update({ likes_count: Math.max(0, count - 1) }).eq('id', postId);
      }
    } catch {
      // Rollback
      setLiked(prevLiked);
      setCount(prevCount);
      error('오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 20,
        background: liked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${liked ? 'rgba(239,68,68,0.4)' : '#1E293B'}`,
        color: liked ? '#EF4444' : '#94A3B8',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontSize: 14, fontWeight: 600,
        transform: loading ? 'scale(0.96)' : 'scale(1)',
      }}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
    >
      <span style={{
        fontSize: 18, lineHeight: 1,
        transition: 'transform 0.2s',
        display: 'inline-block',
        transform: liked ? 'scale(1.2)' : 'scale(1)',
      }}>
        {liked ? '❤️' : '🤍'}
      </span>
      <span>{count.toLocaleString()}</span>
    </button>
  );
}
