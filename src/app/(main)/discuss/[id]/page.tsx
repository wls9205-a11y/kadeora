'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};
const CAT_LABEL: Record<string, string> = { stock: '📊 주식', apt: '🏢 부동산', economy: '💹 경제', free: '✏️ 자유' };

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}

interface Topic {
  id: number; title: string; description: string | null; category: string; topic_type: string;
  option_a: string; option_b: string; vote_a: number; vote_b: number;
  comment_count: number; view_count: number; is_hot: boolean; created_at: string;
}
interface Comment {
  id: number; content: string; created_at: string; likes: number;
  profiles?: { nickname?: string; grade?: number } | null;
}

export default function DiscussDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params?.id as string;
  const { error, success } = useToast();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [myVote, setMyVote] = useState<'a' | 'b' | null>(null);
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
  }, []);

  const loadTopic = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const { data } = await sb.from('discussion_topics').select('*').eq('id', parseInt(topicId, 10)).single();
    if (data) setTopic(data as Topic);
    // Increment view
    if (data) sb.from('discussion_topics').update({ view_count: (data.view_count || 0) + 1 }).eq('id', data.id).then(() => {});
  }, [topicId]);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/discuss/${topicId}/comments`);
      if (res.ok) { const d = await res.json(); setComments(d.comments || []); }
    } catch {}
  }, [topicId]);

  const loadMyVote = useCallback(async () => {
    if (!user) return;
    const sb = createSupabaseBrowser();
    const { data } = await sb.from('discussion_votes').select('vote').eq('topic_id', parseInt(topicId, 10)).eq('author_id', user.id).maybeSingle();
    if (data) setMyVote(data.vote as 'a' | 'b');
  }, [topicId, user]);

  useEffect(() => { loadTopic(); loadComments(); }, [loadTopic, loadComments]);
  useEffect(() => { loadMyVote(); }, [loadMyVote]);

  const handleVote = async (vote: 'a' | 'b') => {
    if (!user) { router.push('/login'); return; }
    if (voting) return;
    setVoting(true);

    // Optimistic update
    if (topic) {
      const prev = myVote;
      setMyVote(vote);
      setTopic(t => t ? {
        ...t,
        vote_a: t.vote_a + (vote === 'a' ? 1 : 0) + (prev === 'a' ? -1 : 0),
        vote_b: t.vote_b + (vote === 'b' ? 1 : 0) + (prev === 'b' ? -1 : 0),
      } : t);
    }

    try {
      const res = await fetch(`/api/discuss/${topicId}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (res.status !== 409) error(d.error || '투표 실패');
        loadTopic(); loadMyVote(); // revert
      }
    } catch { loadTopic(); loadMyVote(); }
    finally { setVoting(false); }
  };

  const handleComment = async () => {
    if (!user) { router.push('/login'); return; }
    const t = input.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await fetch(`/api/discuss/${topicId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: t }),
      });
      if (res.ok) {
        const d = await res.json();
        setComments(prev => [...prev, d.comment]);
        setInput('');
        setTopic(prev => prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev);
      } else {
        const d = await res.json();
        error(d.error || '댓글 작성 실패');
      }
    } catch { error('오류가 발생했습니다.'); }
    finally { setSending(false); }
  };

  if (!topic) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>로딩 중...</div>;

  const total = (topic.vote_a || 0) + (topic.vote_b || 0);
  const pctA = total > 0 ? Math.round((topic.vote_a / total) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, padding: '8px 0', marginBottom: 8 }}>
        ← 돌아가기
      </button>

      {/* Topic */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{CAT_LABEL[topic.category] || topic.category}</span>
          {topic.is_hot && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, fontWeight: 700, background: 'var(--error)', color: 'var(--text-inverse)' }}>🔥 HOT</span>}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>{topic.title}</h1>
        {topic.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>{topic.description}</p>}
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          {timeAgo(topic.created_at)} · 👁 {topic.view_count || 0} · 🗳 {total}명 참여
        </div>

        {/* Vote buttons */}
        {[
          { key: 'a' as const, label: topic.option_a, pct: pctA, count: topic.vote_a, winning: pctA >= pctB },
          { key: 'b' as const, label: topic.option_b, pct: pctB, count: topic.vote_b, winning: pctB > pctA },
        ].map(opt => (
          <button key={opt.key} onClick={() => handleVote(opt.key)} disabled={voting}
            style={{
              width: '100%', padding: '14px 16px', marginBottom: 8, borderRadius: 12,
              border: myVote === opt.key ? '2px solid var(--brand)' : '1px solid var(--border)',
              background: 'var(--bg-base)', cursor: voting ? 'not-allowed' : 'pointer',
              textAlign: 'left', position: 'relative', overflow: 'hidden',
            }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${opt.pct}%`, background: opt.winning ? 'rgba(255,69,0,0.1)' : 'rgba(128,128,128,0.05)',
              borderRadius: 12, transition: 'width 0.3s',
            }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: myVote === opt.key ? 700 : 500, color: 'var(--text-primary)' }}>
                {myVote === opt.key && '✓ '}{opt.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: opt.winning ? 'var(--brand)' : 'var(--text-tertiary)' }}>
                {opt.pct}% <span style={{ fontSize: 11, fontWeight: 400 }}>({opt.count}명)</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Comments */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>의견 {comments.length}개</h2>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {user ? (
            <>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="의견을 남겨보세요" maxLength={500}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit' }} />
              <button onClick={handleComment} disabled={!input.trim() || sending}
                style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: !input.trim() || sending ? 0.5 : 1 }}>
                전송
              </button>
            </>
          ) : (
            <div style={{ flex: 1, textAlign: 'center', padding: 12, color: 'var(--text-tertiary)', fontSize: 13 }}>
              <a href="/login" style={{ color: 'var(--brand)', textDecoration: 'none' }}>로그인</a>하면 의견을 남길 수 있습니다
            </div>
          )}
        </div>

        {/* Comment list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map(c => {
            const nick = (c.profiles as any)?.nickname ?? '사용자';
            const grade = (c.profiles as any)?.grade ?? 1;
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {GRADE_EMOJI[grade] || '🌱'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{nick}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>
              아직 의견이 없어요. 첫 의견을 남겨보세요!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
