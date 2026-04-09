'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { timeAgo } from '@/lib/format';

const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};

interface Topic {
  id: number; title: string; description: string | null; category: string; topic_type: string;
  option_a: string; option_b: string; vote_a: number; vote_b: number;
  comment_count: number; view_count: number; is_hot: boolean; created_at: string;
}
interface Comment {
  id: number; content: string; created_at: string; likes: number;
  profiles?: { nickname?: string; grade?: number } | null;
}

interface Props {
  initialTopic: Topic;
  initialComments: Comment[];
}

export default function DiscussDetailClient({ initialTopic, initialComments }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { error, success } = useToast();

  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [myVote, setMyVote] = useState<'a' | 'b' | null>(null);
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        sb.from('discussion_votes').select('vote')
          .eq('topic_id', initialTopic.id).eq('author_id', u.id).maybeSingle()
          .then(({ data: v }) => { if (v) setMyVote(v.vote as 'a' | 'b'); });
      }
    });
    // Increment view
    sb.from('discussion_topics').update({ view_count: (initialTopic.view_count || 0) + 1 })
      .eq('id', initialTopic.id).then(() => {});
  }, [initialTopic.id, initialTopic.view_count]);

  const handleVote = async (vote: 'a' | 'b') => {
    if (!user) { router.push(`/login?redirect=${encodeURIComponent(pathname)}`); return; }
    if (voting) return;
    setVoting(true);

    const prev = myVote;
    setMyVote(vote);
    setTopic(t => ({
      ...t,
      vote_a: t.vote_a + (vote === 'a' ? 1 : 0) + (prev === 'a' ? -1 : 0),
      vote_b: t.vote_b + (vote === 'b' ? 1 : 0) + (prev === 'b' ? -1 : 0),
    }));

    try {
      const res = await fetch(`/api/discuss/${initialTopic.id}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (res.status !== 409) error(d.error || '투표 실패');
        // Revert on failure
        const sb = createSupabaseBrowser();
        const { data: fresh } = await sb.from('discussion_topics')
          .select('vote_a, vote_b').eq('id', initialTopic.id).single();
        if (fresh) setTopic(t => ({ ...t, vote_a: fresh.vote_a ?? 0, vote_b: fresh.vote_b ?? 0 }));
        setMyVote(prev);
      }
    } catch {
      setMyVote(prev);
    } finally { setVoting(false); }
  };

  const handleComment = async () => {
    if (!user) { router.push(`/login?redirect=${encodeURIComponent(pathname)}`); return; }
    const t = input.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await fetch(`/api/discuss/${initialTopic.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: t }),
      });
      if (res.ok) {
        const d = await res.json();
        setComments(prev => [...prev, d.comment]);
        setInput('');
        setTopic(prev => ({ ...prev, comment_count: (prev.comment_count || 0) + 1 }));
      } else {
        const d = await res.json();
        error(d.error || '댓글 작성 실패');
      }
    } catch { error('오류가 발생했습니다.'); }
    finally { setSending(false); }
  };

  const total = (topic.vote_a || 0) + (topic.vote_b || 0);
  const pctA = total > 0 ? Math.round((topic.vote_a / total) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <>
      {/* Vote buttons */}
      <section style={{ marginTop: 'var(--sp-lg)' }}>
        {[
          { key: 'a' as const, label: topic.option_a, pct: pctA, count: topic.vote_a, winning: pctA >= pctB },
          { key: 'b' as const, label: topic.option_b, pct: pctB, count: topic.vote_b, winning: pctB > pctA },
        ].map(opt => (
          <button key={opt.key} onClick={() => handleVote(opt.key)} disabled={voting}
            style={{
              width: '100%', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-sm)', borderRadius: 'var(--radius-card)',
              border: myVote === opt.key ? '2px solid var(--brand)' : '1px solid var(--border)',
              background: 'var(--bg-base)', cursor: voting ? 'not-allowed' : 'pointer',
              textAlign: 'left', position: 'relative', overflow: 'hidden',
            }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${opt.pct}%`, background: opt.winning ? 'var(--brand-bg)' : 'rgba(128,128,128,0.05)',
              borderRadius: 'var(--radius-card)', transition: 'width 0.3s',
            }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: myVote === opt.key ? 700 : 500, color: 'var(--text-primary)' }}>
                {myVote === opt.key && '✓ '}{opt.label}
              </span>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: opt.winning ? 'var(--brand)' : 'var(--text-tertiary)' }}>
                {opt.pct}% <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400 }}>({opt.count}명)</span>
              </span>
            </div>
          </button>
        ))}
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '4px 0 0' }}>
          🗳 {total}명 참여
        </p>
      </section>

      {/* Comments */}
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginTop: 'var(--sp-lg)' }}>
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>의견 {comments.length}개</h2>

        {/* Input */}
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
          {user ? (
            <>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="의견을 남겨보세요" maxLength={500}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }} />
              <button onClick={handleComment} disabled={!input.trim() || sending}
                style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', fontWeight: 600, fontSize: 'var(--fs-base)', cursor: 'pointer', opacity: !input.trim() || sending ? 0.5 : 1 }}>
                전송
              </button>
            </>
          ) : (
            <div style={{ flex: 1, textAlign: 'center', padding: 12, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              <a href={`/login?redirect=${encodeURIComponent(pathname)}&source=discuss`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>로그인</a>하면 의견을 남길 수 있습니다
            </div>
          )}
        </div>

        {/* Comment list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
          {comments.map(c => {
            const nick = c.profiles?.nickname ?? '사용자';
            const grade = c.profiles?.grade ?? 1;
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-base)' }}>
                  {GRADE_EMOJI[grade] || '🌱'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{nick}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              아직 의견이 없어요. 첫 의견을 남겨보세요!
            </div>
          )}
        </div>
      </section>
    </>
  );
}
