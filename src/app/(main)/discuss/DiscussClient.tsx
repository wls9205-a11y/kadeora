'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageCircle, Heart, Flame } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';
import ChatRoom from './ChatRoom';

interface HotDiscussion {
  id: number; title: string; slug?: string; category: string;
  comments_count: number; likes_count: number;
  profiles?: { nickname?: string } | null;
}

const SUB_ROOMS = [
  { id: 'stock', label: '국내주식', icon: '📊', desc: '종목 토론' },
  { id: 'apt', label: '부동산·청약', icon: '🏢', desc: '청약·매매 이야기' },
  { id: 'crypto', label: '해외주식·코인', icon: '🌐', desc: '해외 투자 토론' },
];

export default function DiscussClient() {
  const [user, setUser] = useState<User | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [hotDiscussions, setHotDiscussions] = useState<HotDiscussion[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [activeRoom, setActiveRoom] = useState('lounge');
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});

  // 활동 인원수 조회
  useEffect(() => {
    const sb = createSupabaseBrowser();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const rooms = ['lounge', 'stock', 'apt', 'crypto'];
    Promise.all(rooms.map(async (room) => {
      const { data } = await sb.from('chat_messages')
        .select('user_id')
        .eq('room', room)
        .gte('created_at', fiveMinAgo);
      const unique = new Set((data ?? []).map((d: any) => d.user_id)).size;
      return { room, count: unique };
    })).then(results => {
      const counts: Record<string, number> = {};
      results.forEach(r => { counts[r.room] = r.count; });
      setActiveCounts(counts);
    });
  }, []);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: p } = await sb.from('profiles').select('nickname').eq('id', u.id).single();
        setMyNickname(p?.nickname ?? null);
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));

    // 뜨거운 토론 — 최근 7일 댓글 많은 글 5개
    sb.from('posts')
      .select('id,title,slug,category,comments_count,likes_count,profiles!posts_author_id_fkey(nickname)')
      .eq('is_deleted', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .gt('comments_count', 0)
      .order('comments_count', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setHotDiscussions(data as HotDiscussion[]); });

    return () => subscription.unsubscribe();
  }, []);

  const CAT_LABEL: Record<string, string> = { stock: '주식', apt: '부동산', local: '우리동네', free: '자유' };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>토론</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>지금 뜨거운 이야기들</p>
      </div>

      {/* 뜨거운 토론 */}
      {hotDiscussions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Flame size={16} style={{ color: 'var(--brand)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>뜨거운 토론</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hotDiscussions.map(d => (
              <Link key={d.id} href={`/feed/${d.slug || d.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                textDecoration: 'none', transition: 'background 0.15s',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{CAT_LABEL[d.category] ?? d.category}</span>
                    <span>{(d.profiles as any)?.nickname ?? '익명'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MessageCircle size={13} /> {d.comments_count}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Heart size={13} /> {d.likes_count}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 메인 라운지 */}
      <button onClick={() => { setActiveRoom('lounge'); setShowChat(true); }} style={{
        width: '100%', padding: '24px 20px', borderRadius: 16, marginBottom: 12,
        border: activeRoom === 'lounge' && showChat ? '2px solid rgba(139,92,246,0.5)' : '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.1) 100%)',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              💬 카더라 라운지
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              자유롭게 수다떨어요 — 주식·부동산·일상 뭐든 OK
            </div>
            <div style={{ fontSize: 12, marginTop: 8, color: (activeCounts.lounge ?? 0) > 0 ? '#22c55e' : 'var(--text-tertiary)' }}>
              {(activeCounts.lounge ?? 0) > 0 ? `🟢 약 ${activeCounts.lounge}명 활동 중` : '💬 조용한 중...'}
            </div>
          </div>
          <div style={{
            padding: '10px 20px', borderRadius: 12,
            background: 'rgba(139,92,246,0.8)', color: '#fff',
            fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}>
            입장하기 →
          </div>
        </div>
      </button>

      {/* 서브 토론방 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {SUB_ROOMS.map(r => (
          <button key={r.id} onClick={() => { setActiveRoom(r.id); setShowChat(true); }} style={{
            padding: '14px 12px', borderRadius: 12,
            border: activeRoom === r.id && showChat ? '2px solid var(--brand)' : '1px solid var(--border)',
            background: activeRoom === r.id && showChat ? 'var(--bg-hover)' : 'var(--bg-surface)',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{r.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{r.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{r.desc}</div>
            <div style={{ fontSize: 11, color: (activeCounts[r.id] ?? 0) > 0 ? '#22c55e' : 'var(--text-tertiary)' }}>
              {(activeCounts[r.id] ?? 0) > 0 ? `🟢 ${activeCounts[r.id]}명` : '—'}
            </div>
          </button>
        ))}
      </div>

      {showChat && (
        <>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 12px',
            marginBottom: 8, lineHeight: 1.5,
            background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)',
          }}>
            투자 관련 대화는 개인 의견이며, 특정 종목 매수/매도 권유는 금지됩니다.
          </div>
          <ChatRoom key={activeRoom} user={user} myNickname={myNickname} room={activeRoom} />
        </>
      )}
    </div>
  );
}
