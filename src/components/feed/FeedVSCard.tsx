'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GRADE_EMOJI } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import type { PostWithProfile } from '@/types/database';

export default function FeedVSCard({ post }: { post: PostWithProfile }) {
  const { userId } = useAuth();
  const { success, error: showError } = useToast();
  const [battle, setBattle] = useState<{ id: number; option_a: string; option_b: string } | null>(null);
  const [votesA, setVotesA] = useState(0);
  const [votesB, setVotesB] = useState(0);
  const [voted, setVoted] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const profile = post.profiles ?? null;
  const nickname = profile?.nickname ?? '익명';
  const grade = profile?.grade ?? 0;

  const loadData = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const { data: b } = await (sb as any).from('vs_battles').select('id,option_a,option_b').eq('post_id', post.id).single();
    if (!b) { setLoading(false); return; }
    setBattle(b);

    const { data: results } = await (sb as any).rpc('get_vs_results', { p_battle_id: b.id });
    if (results) {
      results.forEach((r: { choice: string; vote_count: number }) => {
        if (r.choice === 'A') setVotesA(Number(r.vote_count));
        if (r.choice === 'B') setVotesB(Number(r.vote_count));
      });
    }

    if (userId) {
      const { data: myVote } = await (sb as any).from('vs_votes')
        .select('choice').eq('battle_id', b.id).eq('user_id', userId).maybeSingle();
      if (myVote) setVoted(myVote.choice);
    }
    setLoading(false);
  }, [post.id, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleVote = async (choice: 'A' | 'B') => {
    if (voted || !battle || !userId) return;
    setVoted(choice);
    if (choice === 'A') setVotesA(v => v + 1); else setVotesB(v => v + 1);

    const res = await fetch('/api/feed/vs/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battle_id: battle.id, choice }),
    });
    if (res.ok) success('+5P 적립!');
    else {
      showError('투표 실패');
      setVoted(null);
      if (choice === 'A') setVotesA(v => v - 1); else setVotesB(v => v - 1);
    }
  };

  if (loading || !battle) return null;

  const total = votesA + votesB;
  const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
  const pctB = total > 0 ? 100 - pctA : 50;

  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)',
      border: '1px solid rgba(245,158,11,0.12)', padding: 'var(--sp-md)', marginBottom: 'var(--sp-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-sm)' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'rgba(245,158,11,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>{GRADE_EMOJI[grade] ?? '🌱'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{nickname}</span>
            <span style={{
              padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700,
              background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
            }}>⚔️ VS</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>👀{post.view_count}</span>
      </div>

      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 'var(--sp-sm)' }}>
        {post.title}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: battle.option_a, side: 'A' as const, pct: pctA, color: 'var(--brand)' },
          { label: battle.option_b, side: 'B' as const, pct: pctB, color: 'var(--accent-red)' },
        ].map(o => (
          <button key={o.side} onClick={() => handleVote(o.side)} disabled={!!voted} style={{
            flex: 1, padding: '12px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center',
            background: voted === o.side ? `color-mix(in srgb, ${o.color} 10%, transparent)` : 'var(--bg-hover)',
            border: voted === o.side ? `2px solid ${o.color}` : '1px solid var(--border)',
            cursor: voted ? 'default' : 'pointer', transition: 'all 0.25s',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{o.label}</div>
            {voted && <div style={{ fontSize: 18, fontWeight: 800, color: o.color, marginTop: 4 }}>{o.pct}%</div>}
          </button>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
        {total.toLocaleString()}명 참여 · +5P
      </div>
    </div>
  );
}
