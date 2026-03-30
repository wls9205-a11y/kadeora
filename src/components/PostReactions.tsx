'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Props {
  postId: number;
  userId: string | null;
  initialLikes: number;
  compact?: boolean;
}

const REACTIONS = [
  { key: 'like', emoji: '👍', label: '좋아요' },
  { key: 'fire', emoji: '🔥', label: '불타오름' },
  { key: 'think', emoji: '🤔', label: '생각중' },
  { key: 'surprise', emoji: '😮', label: '놀라움' },
  { key: 'useful', emoji: '📌', label: '유익함' },
] as const;

type ReactionKey = typeof REACTIONS[number]['key'];

const REACTION_COLORS: Record<string, string> = {
  like: 'var(--text-brand)',
  fire: 'var(--accent-red)',
  think: 'var(--accent-yellow)',
  surprise: 'var(--accent-green)',
  useful: '#A78BFA',
};

export default function PostReactions({ postId, userId, initialLikes, compact }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({ like: initialLikes });
  const [myReaction, setMyReaction] = useState<ReactionKey | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const load = async () => {
      const sb = createSupabaseBrowser();
      // 리액션 집계
      const { data: rows } = await (sb as any).from('post_reactions')
        .select('reaction')
        .eq('post_id', postId);
      if (rows && rows.length > 0) {
        const c: Record<string, number> = {};
        rows.forEach((r: any) => { c[r.reaction] = (c[r.reaction] || 0) + 1; });
        setCounts(c);
      }
      // 내 리액션
      if (userId) {
        const { data: myRow } = await (sb as any).from('post_reactions')
          .select('reaction')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single();
        if (myRow) setMyReaction(myRow.reaction as ReactionKey);
      }
    };
    load();
  }, [postId, userId]);

  const handleReact = async (reaction: ReactionKey) => {
    if (!userId) return;
    const sb = createSupabaseBrowser();

    if (myReaction === reaction) {
      // 취소
      await (sb as any).from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
      setCounts(prev => ({ ...prev, [reaction]: Math.max(0, (prev[reaction] || 0) - 1) }));
      setMyReaction(null);
    } else {
      // 새 리액션 (기존 있으면 교체)
      if (myReaction) {
        setCounts(prev => ({ ...prev, [myReaction!]: Math.max(0, (prev[myReaction!] || 0) - 1) }));
      }
      await (sb as any).from('post_reactions').upsert({
        post_id: postId, user_id: userId, reaction,
      }, { onConflict: 'post_id,user_id' });
      setCounts(prev => ({ ...prev, [reaction]: (prev[reaction] || 0) + 1 }));
      setMyReaction(reaction);
    }
    setShowPicker(false);
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sorted = REACTIONS.filter(r => (counts[r.key] || 0) > 0).sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0));

  if (compact) {
    // 컴팩트 모드: 미니 리액션 바 + 총 수
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, position: 'relative' }}>
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowPicker(!showPicker); }}
          style={{ display: 'flex', alignItems: 'center', gap: 2, background: myReaction ? 'rgba(59,123,246,0.08)' : 'none', border: myReaction ? '1px solid rgba(59,123,246,0.2)' : '1px solid transparent', borderRadius: 99, padding: '2px 6px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: myReaction ? REACTION_COLORS[myReaction] : 'var(--text-tertiary)' }}>
          <span style={{ fontSize: 13 }}>{myReaction ? REACTIONS.find(r => r.key === myReaction)?.emoji : '👍'}</span>
          {total > 0 && <span>{total}</span>}
        </button>

        {/* 미니 리액션 분포 바 */}
        {total > 1 && sorted.length > 1 && (
          <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', width: 40 }}>
            {sorted.map(r => (
              <div key={r.key} style={{ flex: counts[r.key] || 0, background: REACTION_COLORS[r.key] }} />
            ))}
          </div>
        )}

        {/* 피커 팝업 */}
        {showPicker && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, display: 'flex', gap: 2, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', zIndex: 10 }}>
            {REACTIONS.map(r => (
              <button key={r.key} onClick={e => { e.preventDefault(); e.stopPropagation(); handleReact(r.key); }}
                title={r.label}
                style={{ fontSize: 16, background: myReaction === r.key ? 'rgba(59,123,246,0.12)' : 'transparent', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span>{r.emoji}</span>
                {(counts[r.key] || 0) > 0 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{counts[r.key]}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
