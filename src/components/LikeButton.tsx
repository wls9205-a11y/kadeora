'use client';
import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
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
          .select('post_id').eq('post_id', postId).eq('user_id', uid).maybeSingle();
        setLiked(!!like);
      }
    });
  }, [postId]);

  const toggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {}
    if (!userId) { window.location.href = '/login'; return; }
    if (loading) return;
    setLoading(true);

    const prevLiked = liked;
    const prevCount = count;

    // Optimistic update
    setLiked(!liked);
    setCount(c => liked ? Math.max(0, (c ?? 0) - 1) : (c ?? 0) + 1);

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) throw new Error('API error');
    } catch {
      // Rollback
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={(e) => toggle(e)}
      disabled={loading}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
      aria-pressed={liked}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 20,
        background: liked ? 'rgba(239,68,68,0.08)' : 'var(--bg-hover)',
        border: `1px solid ${liked ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
        color: liked ? '#F87171' : 'var(--text-secondary)',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        fontSize: 'var(--fs-sm)', fontWeight: 600,
        opacity: loading ? 0.7 : 1,
      }}
    >
      <Heart size={15} fill={liked ? '#F87171' : 'none'} stroke={liked ? '#F87171' : 'currentColor'} />
      <span>{(count ?? 0).toLocaleString()}</span>
    </button>
  );
}
