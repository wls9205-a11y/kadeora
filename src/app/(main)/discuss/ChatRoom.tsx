'use client';
import { useState, useEffect, useRef } from 'react';
import type { DiscussionRoom, MessageWithProfile } from '@/types/database';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';

function timeAgo(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000);
  if (m<1) return '방금'; if (m<60) return m+'분'; return Math.floor(m/60)+'시간';
}

interface ChatRoomProps {
  room: DiscussionRoom;
  user: User | null;
  onClose: () => void;
}

export default function ChatRoom({ room, user, onClose }: ChatRoomProps) {
  const [msgs, setMsgs] = useState<MessageWithProfile[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { error } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('discussion_messages')
      .select('*, profiles(id,nickname,avatar_url)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMsgs((data ?? []) as MessageWithProfile[]);
        setLoading(false);
      });
    const ch = sb.channel('room:' + room.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_messages', filter: 'room_id=eq.' + room.id },
        async p => {
          const nm = p.new as MessageWithProfile;
          const { data: prof } = await sb.from('profiles').select('id,nickname,avatar_url').eq('id', nm.author_id).single();
          setMsgs(prev => [...prev, { ...nm, profiles: prof }]);
        }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const send = async () => {
    if (!user) { error('로그인이 필요합니다'); return; }
    const t = input.trim();
    if (!t || sending) return;
    setSending(true);
    const sb = createSupabaseBrowser();
    await sb.from('discussion_messages').insert({ room_id: room.id, author_id: user.id, content: t, is_anonymous: false });
    setInput('');
    setSending(false);
  };

  const DEMO: MessageWithProfile[] = loading ? [] : [
    { id: 1, room_id: room.id, author_id: 'a', content: '안녕하세요! 이 토론방에 처음 오셨나요?', is_anonymous: false, created_at: new Date(Date.now() - 15 * 60000).toISOString(), profiles: { id: 'a', nickname: '진행자', avatar_url: null } },
    { id: 2, room_id: room.id, author_id: 'b', content: '네 처음 왔어요. 좋은 정보 나눠봐요!', is_anonymous: false, created_at: new Date(Date.now() - 10 * 60000).toISOString(), profiles: { id: 'b', nickname: '새내기', avatar_url: null } },
  ];
  const display = msgs.length > 0 ? msgs : DEMO;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 16, width: '100%', maxWidth: 640, height: '80vh', maxHeight: 700, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} className="animate-modalIn">
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--kd-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--kd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.display_name}</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--kd-text-dim)', marginTop: 2 }}>참여자 {(room.member_count ?? 0).toLocaleString()}명</p>
          </div>
          <button onClick={onClose} aria-label="토론방 닫기" style={{ background: 'none', border: 'none', color: 'var(--kd-text-dim)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading
            ? <div style={{ textAlign: 'center', color: 'var(--kd-text-dim)', padding: '40px 0' }}>채팅 불러오는 중...</div>
            : display.map(msg => (
              <div key={msg.id} style={{ display: 'flex', gap: 8, flexDirection: user?.id === msg.author_id ? 'row-reverse' : 'row' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: user?.id === msg.author_id ? 'var(--kd-primary)' : 'var(--kd-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {(msg.profiles?.nickname ?? 'U')[0].toUpperCase()}
                </div>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', marginBottom: 3, textAlign: user?.id === msg.author_id ? 'right' : 'left' }}>
                    {msg.is_anonymous ? '익명' : (msg.profiles?.nickname ?? '사용자')} · {timeAgo(msg.created_at)}
                  </div>
                  <div style={{ background: user?.id === msg.author_id ? 'var(--kd-primary)' : 'var(--kd-surface-2)', border: '1px solid ' + (user?.id === msg.author_id ? 'transparent' : 'var(--kd-border)'), borderRadius: 12, padding: '8px 12px', fontSize: 14, color: 'var(--kd-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          }
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--kd-border)', display: 'flex', gap: 8 }}>
          {user ? (
            <>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="메시지를 입력하세요 (Enter 전송)"
                maxLength={500}
                aria-label="메시지 입력"
                style={{ flex: 1, background: 'var(--kd-bg)', border: '1px solid var(--kd-border)', borderRadius: 8, color: 'var(--kd-text)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="메시지 전송"
                style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--kd-primary)', color: 'white', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: (!input.trim() || sending) ? 0.5 : 1 }}
              >전송</button>
            </>
          ) : (
            <div style={{ flex: 1, textAlign: 'center', color: 'var(--kd-text-dim)', fontSize: 13, padding: '10px 0' }}>
              <a href="/login" style={{ color: 'var(--kd-primary)', textDecoration: 'none' }}>로그인</a>하면 채팅에 참여할 수 있습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}