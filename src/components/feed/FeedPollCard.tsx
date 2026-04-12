'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GRADE_EMOJI } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import type { PostWithProfile } from '@/types/database';

interface PollOption {
  id: number;
  label: string;
  vote_count: number;
}

export default function FeedPollCard({ post }: { post: PostWithProfile }) {
  const { userId } = useAuth();
  const { success, error: showError } = useToast();
  const [options, setOptions] = useState<PollOption[]>([]);
  const [pollId, setPollId] = useState<number | null>(null);
  const [voted, setVoted] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const profile = post.profiles ?? null;
  const nickname = profile?.nickname ?? '익명';
  const grade = profile?.grade ?? 0;

  const loadPollData = useCallback(async () => {
    const sb = createSupabaseBrowser();
    // poll 가져오기
    const { data: poll } = await (sb as any).from('post_polls').select('id,expires_at').eq('post_id', post.id).single();
    if (!poll) { setLoading(false); return; }
    setPollId(poll.id);

    // 결과 가져오기
    const { data: results } = await (sb as any).rpc('get_poll_results', { p_poll_id: poll.id });
    if (results) {
      setOptions(results);
      setTotal(results.reduce((s: number, r: PollOption) => s + Number(r.vote_count), 0));
    }

    // 내 투표 확인
    if (userId) {
      const { data: myVote } = await (sb as any).from('poll_votes')
        .select('option_id').eq('poll_id', poll.id).eq('user_id', userId).maybeSingle();
      if (myVote) setVoted(myVote.option_id);
    }
    setLoading(false);
  }, [post.id, userId]);

  useEffect(() => { loadPollData(); }, [loadPollData]);

  const handleVote = async (optionId: number) => {
    if (voted !== null || !userId || !pollId) return;
    setVoted(optionId);
    setTotal(prev => prev + 1);
    setOptions(prev => prev.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o));

    const res = await fetch('/api/feed/poll/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poll_id: pollId, option_id: optionId }),
    });
    if (res.ok) {
      success('+5P 적립!');
    } else {
      const data = await res.json();
      showError(data.error || '투표 실패');
      setVoted(null);
      setTotal(prev => prev - 1);
      setOptions(prev => prev.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count - 1 } : o));
    }
  };

  if (loading) return null;

  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)',
      border: '1px solid rgba(34,197,94,0.12)', padding: 'var(--sp-md)', marginBottom: 'var(--sp-sm)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-sm)' }}>
        <Link href={`/profile/${post.author_id}`} style={{
          width: 30, height: 30, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          textDecoration: 'none',
        }}>{GRADE_EMOJI[grade] ?? '🌱'}</Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{nickname}</span>
            <span style={{
              padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700,
              background: 'rgba(34,197,94,0.1)', color: '#22C55E',
            }}>📊 투표</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>👀{post.view_count}</span>
      </div>

      {/* Question */}
      <Link href={`/feed/${post.slug || post.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)', lineHeight: 1.35 }}>
          {post.title}
        </div>
      </Link>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {options.map(opt => {
          const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
          const sel = voted === opt.id;
          const show = voted !== null;
          return (
            <button key={opt.id} onClick={() => handleVote(opt.id)} disabled={voted !== null} style={{
              position: 'relative', padding: '9px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hover)', overflow: 'hidden', textAlign: 'left',
              border: sel ? '1px solid #22C55E' : '1px solid var(--border)',
              cursor: voted !== null ? 'default' : 'pointer', transition: 'all 0.3s',
            }}>
              {show && <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: sel ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                transition: 'width 0.5s', borderRadius: 'var(--radius-sm)',
              }} />}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: sel ? 600 : 400, color: sel ? '#22C55E' : 'var(--text-primary)' }}>
                  {sel && '✓ '}{opt.label}
                </span>
                {show && <span style={{ fontSize: 11, fontWeight: 700, color: sel ? '#22C55E' : 'var(--text-tertiary)' }}>{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span>{total.toLocaleString()}명 참여</span>
        <span>참여 시 +5P</span>
      </div>
    </div>
  );
}
