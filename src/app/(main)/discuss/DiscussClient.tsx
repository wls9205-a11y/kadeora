'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DiscussionRoom, DiscussionMessageWithProfile } from '@/types/database';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';

const CATEGORY_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'stock', label: '📈 주식' },
  { key: 'apt', label: '🏠 청약' },
  { key: 'free', label: '💬 자유' },
];

const SORT_OPTIONS = [
  { key: 'popular', label: '🔥 인기순' },
  { key: 'messages', label: '💬 활성순' },
  { key: 'latest', label: '🕐 최신순' },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간`;
}

function ChatRoom({ room, user, onClose }: { room: DiscussionRoom; user: User | null; onClose: () => void }) {
  const [messages, setMessages] = useState<DiscussionMessageWithProfile[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { error } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();

    // Load existing messages
    sb.from('discussion_messages')
      .select('*, profiles(id,nickname,avatar_url)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages((data ?? []) as DiscussionMessageWithProfile[]);
        setLoading(false);
      });

    // Realtime subscription
    const channel = sb.channel(`room:${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'discussion_messages',
        filter: `room_id=eq.${room.id}`,
      }, async payload => {
        const newMsg = payload.new as DiscussionMessageWithProfile;
        // Fetch profile
        const { data: profile } = await sb.from('profiles').select('id,nickname,avatar_url').eq('id', newMsg.user_id).single();
        setMessages(prev => [...prev, { ...newMsg, profiles: profile }]);
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!user) { error('로그인이 필요합니다'); return; }
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    const sb = createSupabaseBrowser();
    const { error: err } = await sb.from('discussion_messages').insert({
      room_id: room.id, user_id: user.id, content: text,
    });
    if (err) { error('메시지 전송 실패'); }
    else {
      setInput('');
      // Update room messages_count
      await sb.from('discussion_rooms').update({ messages_count: room.post_count + 1 }).eq('id', room.id);
    }
    setSending(false);
  };

  const DEMO_MESSAGES: DiscussionMessageWithProfile[] = loading ? [] : messages.length === 0 ? [
    { id: 1, room_id: room.id, user_id: 'a', content: '안녕하세요! 이 토론방에 처음 오셨나요?', created_at: new Date(Date.now() - 15 * 60000).toISOString(), profiles: { id: 'a', nickname: '진행자', avatar_url: null } },
    { id: 2, room_id: room.id, user_id: 'b', content: '네 처음 왔어요. 좋은 정보 나눠봐요!', created_at: new Date(Date.now() - 10 * 60000).toISOString(), profiles: { id: 'b', nickname: '새내기', avatar_url: null } },
  ] : [];

  const displayMessages = messages.length > 0 ? messages : DEMO_MESSAGES;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#111827', border: '1px solid #1E293B', borderRadius: 16,
        width: '100%', maxWidth: 640, height: '80vh', maxHeight: 700,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }} className="animate-modalIn">
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {room.title}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', marginTop: 2 }}>
              참여자 {room.member_count.toLocaleString()}명
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '40px 0' }}>채팅 불러오는 중...</div>
          ) : displayMessages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex', gap: 8,
              flexDirection: user?.id === msg.user_id ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: user?.id === msg.user_id ? '#3B82F6' : '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'white',
              }}>
                {(msg.profiles?.nickname ?? 'U')[0].toUpperCase()}
              </div>
              <div style={{ maxWidth: '70%' }}>
                <div style={{
                  fontSize: 11, color: '#64748B', marginBottom: 3,
                  textAlign: user?.id === msg.user_id ? 'right' : 'left',
                }}>
                  {msg.profiles?.nickname ?? '익명'} · {timeAgo(msg.created_at)}
                </div>
                <div style={{
                  background: user?.id === msg.user_id ? '#3B82F6' : '#1a2234',
                  border: `1px solid ${user?.id === msg.user_id ? 'transparent' : '#1E293B'}`,
                  borderRadius: 12, padding: '8px 12px',
                  fontSize: 14, color: '#F1F5F9', lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1E293B', display: 'flex', gap: 8 }}>
          {user ? (
            <>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="메시지를 입력하세요 (Enter 전송)"
                maxLength={500}
                style={{
                  flex: 1, background: '#0A0E17', border: '1px solid #1E293B',
                  borderRadius: 8, color: '#F1F5F9', padding: '10px 12px', fontSize: 14,
                  fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                style={{
                  padding: '10px 16px', borderRadius: 8,
                  background: '#3B82F6', color: 'white', border: 'none',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  opacity: (!input.trim() || sending) ? 0.5 : 1,
                }}
              >전송</button>
            </>
          ) : (
            <div style={{ flex: 1, textAlign: 'center', color: '#64748B', fontSize: 13, padding: '10px 0' }}>
              <a href="/login" style={{ color: '#3B82F6', textDecoration: 'none' }}>로그인</a>하면 채팅에 참여할 수 있습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscussClient({ rooms, isDemo }: { rooms: DiscussionRoom[]; isDemo: boolean }) {
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('popular');
  const [activeRoom, setActiveRoom] = useState<DiscussionRoom | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const filtered = rooms
    .filter(r => category === 'all' || r.category === category)
    .sort((a, b) => {
      if (sort === 'popular') return b.participants_count - a.participants_count;
      if (sort === 'messages') return b.messages_count - a.messages_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const CAT_COLORS: Record<string, string> = { stock: '#3B82F6', apt: '#10B981', free: '#8B5CF6' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F1F5F9' }}>💬 토론방</h1>
        {isDemo && (
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
            💡 미리보기 데이터
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#111827', borderRadius: 10, padding: 4, border: '1px solid #1E293B' }}>
          {CATEGORY_FILTERS.map(f => (
            <button key={f.key} onClick={() => setCategory(f.key)} style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: category === f.key ? '#3B82F6' : 'transparent',
              color: category === f.key ? 'white' : '#94A3B8',
              transition: 'all 0.15s',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#111827', borderRadius: 10, padding: 4, border: '1px solid #1E293B', marginLeft: 'auto' }}>
          {SORT_OPTIONS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)} style={{
              padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: sort === s.key ? '#1a2234' : 'transparent',
              color: sort === s.key ? '#F1F5F9' : '#64748B',
              transition: 'all 0.15s',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {filtered.map(room => (
          <div
            key={room.id}
            onClick={() => setActiveRoom(room)}
            style={{
              background: '#111827', border: '1px solid #1E293B', borderRadius: 14,
              padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#334155';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#1E293B';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                background: `${CAT_COLORS[room.category] ?? '#94A3B8'}20`,
                color: CAT_COLORS[room.category] ?? '#94A3B8',
              }}>{room.category === 'stock' ? '주식' : room.category === 'apt' ? '청약' : '자유'}</span>
              {room.is_active && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10B981' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  LIVE
                </span>
              )}
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.4 }}>
              {room.title}
            </h3>
            {room.description && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {room.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
              <span>👥 {room.member_count.toLocaleString()}</span>
              <span>💬 {room.post_count.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {activeRoom && (
        <ChatRoom room={activeRoom} user={user} onClose={() => setActiveRoom(null)} />
      )}
    </div>
  );
}
