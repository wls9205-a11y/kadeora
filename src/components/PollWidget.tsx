'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface PollData {
  id: number;
  question: string;
  options: string[];
  counts: number[];
  total: number;
  myVote: number | null;
  expired: boolean;
  ends_at: string | null;
}

interface Props {
  postId: number;
  isAuthor?: boolean;
}

export default function PollWidget({ postId, isAuthor = false }: Props) {
  const router = useRouter();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/polls?post_id=${postId}`);
      const { poll: p } = await res.json();
      setPoll(p);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { fetchPoll(); }, [fetchPoll]);

  const handleVote = async (idx: number) => {
    if (voting || !poll || poll.expired) return;
    setVoting(true);
    // 낙관적 업데이트
    setPoll(prev => {
      if (!prev) return prev;
      const newCounts = [...prev.counts];
      if (prev.myVote !== null) newCounts[prev.myVote]--;
      newCounts[idx]++;
      return { ...prev, counts: newCounts, myVote: idx, total: prev.myVote !== null ? prev.total : prev.total + 1 };
    });
    try {
      const res = await fetch('/api/polls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_id: poll.id, option_index: idx }),
      });
      if (!res.ok) {
        if ((await res.json()).error === '로그인 필요') {
          router.push('/login');
        }
        await fetchPoll(); // 실패 시 서버 상태로 복원
      }
    } catch { await fetchPoll(); } finally { setVoting(false); }
  };

  if (loading) return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', opacity: 0.5 }}>
      <div style={{ height: 12, background: 'var(--border)', borderRadius: 'var(--radius-xs)', marginBottom: 'var(--sp-sm)' }} />
      <div style={{ height: 28, background: 'var(--border)', borderRadius: 'var(--radius-xs)', marginBottom: 'var(--sp-xs)' }} />
      <div style={{ height: 28, background: 'var(--border)', borderRadius: 'var(--radius-sm)' }} />
    </div>
  );
  if (!poll) return null;

  const hasVoted = poll.myVote !== null;
  const showResults = hasVoted || poll.expired;

  return (
    <div style={{
      marginTop: 10, padding: 'var(--sp-md) var(--card-p)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>🗳️</span>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          {poll.question}
        </span>
        {poll.expired && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: 4 }}>
            마감
          </span>
        )}
      </div>

      {/* 선택지 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {poll.options.map((opt, idx) => {
          const count = poll.counts[idx] ?? 0;
          const pct = poll.total > 0 ? Math.round((count / poll.total) * 100) : 0;
          const isMine = poll.myVote === idx;

          return (
            <button
              key={idx}
              onClick={() => !showResults && handleVote(idx)}
              disabled={voting || showResults}
              style={{
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 'var(--radius-sm)', textAlign: 'left',
                border: `1.5px solid ${isMine ? 'var(--brand)' : 'var(--border)'}`,
                background: showResults ? 'transparent' : 'var(--bg-hover)',
                cursor: showResults ? 'default' : 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              {/* 결과 바 */}
              {showResults && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: isMine ? 'rgba(37,99,235,0.12)' : 'var(--bg-hover)',
                  transition: 'width 0.4s ease',
                  borderRadius: 'var(--radius-xs)',
                }} />
              )}
              <span style={{ position: 'relative', fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: isMine ? 700 : 400 }}>
                {isMine && <span style={{ marginRight: 4 }}>✓</span>}
                {opt}
              </span>
              {showResults && (
                <span style={{ position: 'relative', fontSize: 'var(--fs-xs)', color: isMine ? 'var(--brand)' : 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0 }}>
                  {pct}% ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 푸터 */}
      <div style={{ marginTop: 'var(--sp-sm)', fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 'var(--sp-sm)' }}>
        <span>총 {poll.total}명 참여</span>
        {poll.ends_at && !poll.expired && (
          <span>· {new Date(poll.ends_at).toLocaleDateString('ko-KR')} 마감</span>
        )}
        {!showResults && <span>· 투표 후 결과 확인</span>}
      </div>
    </div>
  );
}
