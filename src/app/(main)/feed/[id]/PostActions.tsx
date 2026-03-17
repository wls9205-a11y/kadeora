'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';

interface Props {
  postId: number;
  authorId: string;
  initialLikes: number;
  initialComments: number;
}

export default function PostActions({ postId, authorId, initialLikes, initialComments }: Props) {
  const router = useRouter();
  const { success, error } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [loading, setLoading] = useState({ like: false, bookmark: false });

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const [likeRes, bmRes] = await Promise.all([
          sb.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', u.id).maybeSingle(),
          sb.from('bookmarks').select('post_id').eq('post_id', postId).eq('user_id', u.id).maybeSingle(),
        ]);
        setLiked(!!likeRes.data);
        setBookmarked(!!bmRes.data);
      }
    });
  }, [postId]);

  async function handleLike() {
    if (!user) { router.push('/login'); return; }
    if (loading.like) return;
    setLoading(p => ({ ...p, like: true }));
    const sb = createSupabaseBrowser();
    if (liked) {
      await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      await sb.from('posts').update({ likes_count: likes - 1 }).eq('id', postId);
      setLiked(false); setLikes(p => p - 1);
    } else {
      await sb.from('post_likes').insert({ post_id: postId, user_id: user.id });
      await sb.from('posts').update({ likes_count: likes + 1 }).eq('id', postId);
      setLiked(true); setLikes(p => p + 1);
    }
    setLoading(p => ({ ...p, like: false }));
  }

  async function handleBookmark() {
    if (!user) { router.push('/login'); return; }
    if (loading.bookmark) return;
    setLoading(p => ({ ...p, bookmark: true }));
    const sb = createSupabaseBrowser();
    if (bookmarked) {
      await sb.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
      setBookmarked(false); success('북마크를 해제했습니다');
    } else {
      await sb.from('bookmarks').insert({ post_id: postId, user_id: user.id });
      setBookmarked(true); success('북마크에 저장됐습니다');
    }
    setLoading(p => ({ ...p, bookmark: false }));
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        success('링크가 복사됐습니다');
      } else {
        const el = document.createElement('textarea');
        el.value = url; el.style.position = 'fixed'; el.style.opacity = '0';
        document.body.appendChild(el); el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        success('링크가 복사됐습니다');
      }
    } catch { error('공유에 실패했습니다'); }
  }

  const btnStyle = (active = false, color = 'var(--brand)') => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 20,
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}22` : 'transparent',
    color: active ? color : 'var(--text-tertiary)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      {/* 좋아요 */}
      <button onClick={handleLike} disabled={loading.like}
        aria-label={liked ? '좋아요 취소' : '좋아요'}
        aria-pressed={liked}
        style={btnStyle(liked)}>
        {liked ? '❤️' : '🤍'} {(likes ?? 0).toLocaleString()}
      </button>

      {/* 댓글 수 표시 */}
      <div style={btnStyle()}>
        💬 {(initialComments ?? 0).toLocaleString()}
      </div>

      {/* 공유 */}
      <button onClick={handleShare} style={btnStyle()}>
        🔗 공유
      </button>

      {/* 북마크 */}
      <button onClick={handleBookmark} disabled={loading.bookmark}
        aria-label={bookmarked ? '북마크 해제' : '북마크 추가'}
        aria-pressed={bookmarked}
        style={btnStyle(bookmarked, '#3B82F6')}>
        {bookmarked ? '🔖' : '🏷'} {bookmarked ? '저장됨' : '저장'}
      </button>

      {/* 신고 (로그인 시만) */}
      {user && user.id !== authorId && (
        <button
          onClick={async () => {
            if (!confirm('이 게시글을 신고하시겠습니까?')) return;
            const sb = createSupabaseBrowser();
            await sb.from('reports').insert({ post_id: postId, reporter_id: user.id, reason: '부적절한 내용' });
            success('신고가 접수됐습니다');
          }}
          style={{ ...btnStyle(), marginLeft: 'auto', color: 'var(--error)', borderColor: 'transparent' }}>
          🚩 신고
        </button>
      )}
    </div>
  );
}