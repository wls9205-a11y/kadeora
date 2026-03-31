'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import SectionShareButton from '@/components/SectionShareButton';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';
import ChatRoom from './ChatRoom';
import { timeAgo } from '@/lib/format';

const TABS = [
  { key: 'lounge', label: '💬 전체' },
  { key: 'stock', label: '📊 주식방' },
  { key: 'apt', label: '🏢 부동산방' },
  { key: 'free', label: '✏️ 자유방' },
  { key: 'poll', label: '🗳 투표' },
];

const ROOM_MAP: Record<string, string> = {
  lounge: 'lounge',
  stock: 'stock',
  apt: 'apt',
  free: 'free',
};

const CAT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  stock: { bg: 'rgba(56,189,248,0.12)', color: '#38BDF8', label: '📊 주식' },
  apt: { bg: 'rgba(52,211,153,0.12)', color: 'var(--accent-green)', label: '🏢 부동산' },
  economy: { bg: 'rgba(251,191,36,0.12)', color: 'var(--accent-yellow)', label: '💹 경제' },
  free: { bg: 'rgba(167,139,250,0.12)', color: 'var(--accent-purple)', label: '✏️ 자유' },
};

interface Topic {
  id: number; title: string; category: string; topic_type: string;
  option_a: string; option_b: string; vote_a: number; vote_b: number;
  comment_count: number; view_count: number; is_hot: boolean; is_pinned: boolean;
  created_at: string; profiles?: { nickname?: string } | null;
}

function TopicCard({ topic }: { topic: Topic }) {
  const total = (topic.vote_a || 0) + (topic.vote_b || 0);
  const pctA = total > 0 ? Math.round((topic.vote_a / total) * 100) : 50;
  const pctB = 100 - pctA;
  const cat = CAT_STYLE[topic.category] || CAT_STYLE.free;

  return (
    <Link href={`/discuss/${topic.id}`} style={{ textDecoration: 'none' }}>
      <div className="kd-card-hover" style={{
        padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-sm)',
      }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-sm)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: cat.bg, color: cat.color }}>{cat.label}</span>
          {topic.is_hot && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 999, fontWeight: 700, background: 'var(--error)', color: 'var(--text-inverse)' }}>🔥 HOT</span>}
        </div>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', lineHeight: 1.4 }}>{topic.title}</h3>
        {topic.topic_type === 'poll' && (
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            {[
              { label: topic.option_a, pct: pctA, winning: pctA >= pctB },
              { label: topic.option_b, pct: pctB, winning: pctB > pctA },
            ].map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, minWidth: 60, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                <div style={{ flex: 1, height: 22, background: 'var(--bg-hover)', borderRadius: 11, overflow: 'hidden' }}>
                  <div style={{ width: `${opt.pct}%`, height: '100%', background: opt.winning ? 'var(--brand)' : 'var(--border)', borderRadius: 11, transition: 'width 0.3s', minWidth: opt.pct > 0 ? 8 : 0 }} />
                </div>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, minWidth: 36, textAlign: 'right', color: opt.winning ? 'var(--brand)' : 'var(--text-tertiary)' }}>{opt.pct}%</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          <span>💬 {topic.comment_count || 0}</span>
          <span>👁 {topic.view_count || 0}</span>
          <span>🗳 {total}명</span>
          <span style={{ marginLeft: 'auto' }}>{timeAgo(topic.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}

// --- Poll sub-filter ---
const POLL_CATS = [
  { key: 'all', label: '전체' },
  { key: 'stock', label: '주식' },
  { key: 'apt', label: '부동산' },
  { key: 'economy', label: '경제' },
  { key: 'free', label: '자유' },
];

export default function DiscussClient() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState('lounge');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [pollCat, setPollCat] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { error, success } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    // Active users (messages in last 5 min)
    sb.from('discussion_messages').select('user_id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 5 * 60000).toISOString())
      .then(({ count }) => setActiveUsers(count || 0));
    return () => subscription.unsubscribe();
  }, []);

  const loadTopics = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discuss?category=${cat}`);
      if (res.ok) { const d = await res.json(); setTopics(d.topics || []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'poll') loadTopics(pollCat); }, [tab, pollCat, loadTopics]);

  // Create topic state
  const [newTitle, setNewTitle] = useState('');
  const [newCat, setNewCat] = useState('free');
  const [newOptA, setNewOptA] = useState('찬성');
  const [newOptB, setNewOptB] = useState('반대');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user) { error('로그인이 필요합니다.'); return; }
    if (newTitle.trim().length < 5) { error('주제는 5자 이상이어야 합니다.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/discuss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, category: newCat, option_a: newOptA, option_b: newOptB }),
      });
      if (res.ok) {
        success('토론이 생성되었습니다!');
        setShowCreate(false); setNewTitle(''); setNewOptA('찬성'); setNewOptB('반대');
        loadTopics(pollCat);
      } else { const d = await res.json(); error(d.error || '생성 실패'); }
    } catch { error('오류가 발생했습니다.'); }
    finally { setCreating(false); }
  };

  const hotTopics = topics.filter(t => t.is_hot || t.is_pinned);
  const regularTopics = topics.filter(t => !t.is_hot && !t.is_pinned);
  const isChat = tab !== 'poll';

  // Fullscreen flex layout for chat tabs, normal scroll for poll tab
  const containerStyle: React.CSSProperties = isChat ? {
    maxWidth: 720, margin: '0 auto', padding: '0 16px',
    display: 'flex', flexDirection: 'column',
    height: 'calc(100dvh - 104px)',
    minHeight: 'calc(100vh - 160px)',
  } : {
    maxWidth: 720, margin: '0 auto', padding: '0 16px',
  };

  return (
    <div style={containerStyle}>
      <div style={{ flexShrink: 0, marginBottom: isChat ? 8 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>💬 라운지</h1>
          <SectionShareButton section="discuss" label="실시간 토론 라운지 — 주식·부동산·경제 이슈" pagePath="/discuss" />
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>지금 뜨거운 이야기들
          {activeUsers > 0 && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 700, marginLeft: 8 }}>
              🟢 {activeUsers}명 참여중
            </span>
          )}
        </p>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: isChat ? 8 : 12, overflowX: 'auto', scrollbarWidth: 'none',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px',
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
            fontWeight: 700, fontSize: 'var(--fs-sm)',
            background: tab === t.key ? 'var(--brand)' : 'transparent',
            color: tab === t.key ? 'var(--text-inverse)' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 채팅 탭 — flex:1로 남은 공간 100% 채움 */}
      {isChat && <ChatRoom user={user} room={ROOM_MAP[tab] || 'lounge'} />}

      {/* 투표 탭 */}
      {tab === 'poll' && (
        <>
          {/* 투표 카테고리 서브필터 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {POLL_CATS.map(c => (
              <button key={c.key} onClick={() => setPollCat(c.key)} aria-pressed={pollCat === c.key} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: pollCat === c.key ? 'var(--text-primary)' : 'var(--bg-hover)',
                color: pollCat === c.key ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}>{c.label}</button>
            ))}
          </div>

          {/* 새 토론 만들기 */}
          <button onClick={() => user ? setShowCreate(!showCreate) : router.push(`/login?redirect=${encodeURIComponent(pathname)}`)} style={{
            width: '100%', padding: '12px', marginBottom: 'var(--sp-md)', borderRadius: 12,
            border: '1px dashed var(--border)', background: 'var(--bg-surface)',
            color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer',
          }}>✍️ 새 토론 만들기</button>

          {showCreate && (
            <div style={{ padding: 16, marginBottom: 'var(--sp-md)', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {['stock', 'apt', 'economy', 'free'].map(c => (
                  <button key={c} onClick={() => setNewCat(c)} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: newCat === c ? 'var(--brand)' : 'var(--bg-hover)',
                    color: newCat === c ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}>{(CAT_STYLE[c] || CAT_STYLE.free).label}</button>
                ))}
              </div>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="토론 주제 (5자 이상)" maxLength={100}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', marginBottom: 'var(--sp-sm)', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newOptA} onChange={e => setNewOptA(e.target.value)} placeholder="옵션 A" maxLength={20}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
                <span style={{ alignSelf: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>vs</span>
                <input value={newOptB} onChange={e => setNewOptB(e.target.value)} placeholder="옵션 B" maxLength={20}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }} />
              </div>
              <button onClick={handleCreate} disabled={creating} style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1,
              }}>{creating ? '생성 중...' : '토론 시작하기'}</button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>로딩 중...</div>
          ) : topics.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 40, marginBottom: 'var(--sp-sm)' }}>🗳️</div>
              <div style={{ fontSize: 'var(--fs-base)' }}>아직 토론이 없습니다. 첫 번째 토론을 시작해보세요!</div>
            </div>
          ) : (
            <>
              {hotTopics.length > 0 && (
                <div style={{ marginBottom: 'var(--sp-sm)' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>🔥 HOT 토론</div>
                  {hotTopics.map(t => <TopicCard key={t.id} topic={t} />)}
                </div>
              )}
              {regularTopics.map(t => <TopicCard key={t.id} topic={t} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}
