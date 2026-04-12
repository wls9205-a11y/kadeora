'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GRADE_EMOJI } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import type { PostWithProfile } from '@/types/database';

export default function FeedPredictCard({ post }: { post: PostWithProfile }) {
  const { userId } = useAuth();
  const { success, error: showError } = useToast();
  const [prediction, setPrediction] = useState<{ id: number; target: string; direction: string; deadline: string; resolved: boolean; result: boolean | null } | null>(null);
  const [agreeCount, setAgreeCount] = useState(0);
  const [disagreeCount, setDisagreeCount] = useState(0);
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const profile = post.profiles ?? null;
  const nickname = profile?.nickname ?? '익명';
  const grade = profile?.grade ?? 0;

  const loadData = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const { data: pred } = await (sb as any).from('predictions').select('*').eq('post_id', post.id).single();
    if (!pred) { setLoading(false); return; }
    setPrediction(pred);

    const { data: results } = await (sb as any).rpc('get_prediction_results', { p_prediction_id: pred.id });
    if (results?.[0]) {
      setAgreeCount(Number(results[0].agree_count));
      setDisagreeCount(Number(results[0].disagree_count));
    }

    if (userId) {
      const { data: vote } = await (sb as any).from('prediction_votes')
        .select('agree').eq('prediction_id', pred.id).eq('user_id', userId).maybeSingle();
      if (vote) setMyVote(vote.agree);
    }
    setLoading(false);
  }, [post.id, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleVote = async (agree: boolean) => {
    if (myVote !== null || !prediction || !userId) return;
    setMyVote(agree);
    if (agree) setAgreeCount(v => v + 1); else setDisagreeCount(v => v + 1);

    const res = await fetch('/api/feed/predict/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prediction_id: prediction.id, agree }),
    });
    if (res.ok) success('+5P 적립!');
    else {
      showError('참여 실패');
      setMyVote(null);
      if (agree) setAgreeCount(v => v - 1); else setDisagreeCount(v => v - 1);
    }
  };

  if (loading || !prediction) return null;

  const total = agreeCount + disagreeCount;
  const isUp = prediction.direction === 'up';

  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)',
      border: '1px solid rgba(168,85,247,0.12)', padding: 'var(--sp-md)', marginBottom: 'var(--sp-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-sm)' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'rgba(168,85,247,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>{GRADE_EMOJI[grade] ?? '🌱'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{nickname}</span>
            <span style={{
              padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700,
              background: 'rgba(168,85,247,0.1)', color: '#A855F7',
            }}>🔮 예측</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>👀{post.view_count}</span>
      </div>

      <Link href={`/feed/${post.slug || post.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.35 }}>
          {post.title}
        </div>
      </Link>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', borderRadius: 6, marginBottom: 'var(--sp-sm)',
        background: isUp ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
      }}>
        <span style={{ fontSize: 14 }}>{isUp ? '📈' : '📉'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: isUp ? '#22C55E' : '#EF4444' }}>{prediction.target}</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {prediction.deadline}까지</span>
      </div>

      {prediction.resolved ? (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginTop: 4,
          background: prediction.result ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          textAlign: 'center', fontSize: 14, fontWeight: 700,
          color: prediction.result ? '#22C55E' : '#EF4444',
        }}>
          {prediction.result ? '🎯 적중!' : '❌ 미적중'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: '동의', agree: true, cnt: agreeCount, color: '#22C55E', icon: '👍' },
            { label: '반대', agree: false, cnt: disagreeCount, color: '#EF4444', icon: '👎' },
          ].map(o => (
            <button key={o.label} onClick={() => handleVote(o.agree)} disabled={myVote !== null} style={{
              flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: myVote === o.agree ? `color-mix(in srgb, ${o.color} 10%, transparent)` : 'var(--bg-hover)',
              border: myVote === o.agree ? `1px solid ${o.color}` : '1px solid var(--border)',
              color: myVote === o.agree ? o.color : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: myVote !== null ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            }}>
              {o.icon} {o.label}
              {myVote !== null && total > 0 && (
                <span style={{ fontWeight: 800 }}>{Math.round((o.cnt / total) * 100)}%</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span>{total.toLocaleString()}명 참여</span>
        <span>🏆 적중 시 +50P</span>
      </div>
    </div>
  );
}
