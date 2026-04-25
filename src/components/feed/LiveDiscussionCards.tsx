'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Room {
  id: number | string;
  title: string;
  participants: number;
}

/**
 * 피드 상단 — 활성 토론방 가로 스크롤 카드
 * Source: discussion_topics ORDER BY comment_count + view_count DESC LIMIT 8
 */
export default function LiveDiscussionCards() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const sb = createSupabaseBrowser() as any;
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await sb
          .from('discussion_topics')
          .select('id, title, vote_a, vote_b, comment_count')
          .order('comment_count', { ascending: false })
          .limit(8);
        if (cancelled) return;
        const mapped: Room[] = (data || []).map((t: any) => ({
          id: t.id,
          title: t.title || '제목 없음',
          participants: (t.vote_a || 0) + (t.vote_b || 0) + (t.comment_count || 0),
        })).filter((r: Room) => r.title.trim().length > 0);
        setRooms(mapped);
      } catch {
        if (!cancelled) setRooms([]);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (rooms.length === 0) return null;

  return (
    <div
      className="kd-scroll-row"
      style={{ margin: '0 0 8px', padding: '2px 0' }}
    >
      {rooms.map((r) => (
        <Link
          key={r.id}
          href={`/discuss/${r.id}`}
          style={{
            flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 9,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', cursor: 'pointer',
            maxWidth: 220,
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: '#EF4444',
            flexShrink: 0, animation: 'kdDotPulse 1.2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0,
          }}>{r.participants}</span>
          <span style={{
            fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{r.title}</span>
        </Link>
      ))}
      <style jsx>{`
        @keyframes kdDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
