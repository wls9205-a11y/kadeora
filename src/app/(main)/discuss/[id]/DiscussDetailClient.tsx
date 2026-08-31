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

  /* ⛔ 호출자 없음 — 읽기 전용 아카이브 전환으로 투표 버튼을 disabled 로 바꿨다(2026-08-31).
     함수를 «남겨 둔» 이유: 되살릴 때 로직을 다시 쓰지 않게. 다만 그때는 API 도 같이 열어야 한다
     (/api/discuss/[id]/vote 는 현재 410). ⛔ UI 만 재배선하면 눌러도 410 이 난다. */
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
          .select('vote_a, vote_b').eq('id', initialTopic.id).maybeSingle();
        if (fresh) setTopic(t => ({ ...t, vote_a: fresh.vote_a ?? 0, vote_b: fresh.vote_b ?? 0 }));
        setMyVote(prev);
      }
    } catch {
      setMyVote(prev);
    } finally { setVoting(false); }
  };

  /* ⛔ 호출자 없음 — 위와 같다. 되살릴 때 /api/discuss/[id]/comments 의 410 도 함께 푼다. */
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
          /* ⛔ 읽기 전용 아카이브 — 투표 쓰기를 닫고, «결과 표시도» 내렸다(2026-08-31).
              실측: 카운터 vote_a+vote_b 2,002 대 discussion_votes 실행 «2건»(전부 시드) — 1,001배.
              실체 없는 결과는 결과가 아니다(view_count 「합성값 노출 금지」 판례와 같은 계열).
              ✅ 선택지 문구는 실제 콘텐츠라 남긴다. 걷는 것은 «수치» 뿐이다. */
          <button key={opt.key} disabled aria-disabled="true" title="이 토론은 보관 상태입니다"
            style={{
              width: '100%', padding: 'var(--card-p) var(--sp-lg)', marginBottom: 'var(--sp-sm)', borderRadius: 'var(--radius-card)',
              border: myVote === opt.key ? '2px solid var(--brand)' : '1px solid var(--border)',
              background: 'var(--bg-base)', cursor: voting ? 'not-allowed' : 'pointer',
              textAlign: 'left', position: 'relative', overflow: 'hidden',
            }}>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: myVote === opt.key ? 600 : 500, color: 'var(--text-primary)' }}>
                {myVote === opt.key && '✓ '}{opt.label}
              </span>
            </div>
          </button>
        ))}
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '4px 0 0' }}>
          투표 종료 — 보관된 토론입니다
        </p>
      </section>

      {/* Comments */}
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginTop: 'var(--sp-lg)' }}>
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>의견 {comments.length}개</h2>

        {/* ⛔ 의견 입력을 닫았다 — /discuss 는 읽기 전용 아카이브다(Node 판정 2026-08-31).
             실측: discussion_comments «역사상 0건». 남길 사람이 없던 자리다.
             ⚠️ 로그인 유도로 바꾸지 «않는다» — 로그인해도 쓸 수 없는데 로그인을 권하면
                그것이 거짓 안내다. 상태를 그대로 말한다(§2-5: 다음 행동을 말한다). */}
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: 12, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
            보관된 토론입니다. 새 의견은 받지 않습니다 —{' '}
            <a href="/apt" style={{ color: 'var(--brand)', textDecoration: 'none' }}>분양 현장</a>에서 이어가 주세요.
          </div>
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
