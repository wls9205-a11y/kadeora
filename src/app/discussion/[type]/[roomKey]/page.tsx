'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Profile {
  nickname: string;
  avatar_url?: string | null;
  grade?: string | null;
}

interface Message {
  id: number;
  author_id: string;
  content: string;
  created_at: string;
  is_anonymous: boolean;
  is_mine?: boolean;
  profiles?: Profile | null;
}

interface RoomInfo {
  id: number;
  room_key: string;
  display_name: string;
  description?: string | null;
  member_count?: number;
}

export default function DiscussionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomType = params?.type as string;
  const roomKey = params?.roomKey as string;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; nickname: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowser();

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('nickname')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) =>
            setCurrentUser({ id: session.user.id, nickname: data?.nickname ?? '익명' })
          );
      }
    });
  }, []);

  // Load room by room_key
  useEffect(() => {
    if (!roomKey) return;
    const load = async () => {
      const { data: rd } = await supabase
        .from('discussion_rooms')
        .select('*')
        .eq('room_key', roomKey)
        .single();
      if (rd) setRoom(rd);
    };
    load();
  }, [roomKey]);

  // Load messages once we have room.id
  useEffect(() => {
    if (!room) return;
    setIsLoading(true);
    supabase
      .from('discussion_messages')
      .select('*, profiles!discussion_messages_author_id_fkey(nickname, avatar_url, grade)')
      .eq('room_id', room.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((m: Record<string, unknown>) => ({
              ...(m as Message),
              is_mine: (m as { author_id?: string }).author_id === currentUser?.id,
            }))
          );
          setTimeout(scrollToBottom, 100);
        }
        setIsLoading(false);
      });
  }, [room, currentUser]);

  // Realtime subscription
  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel('room-' + room.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discussion_messages',
          filter: 'room_id=eq.' + room.id,
        },
        async (payload) => {
          const m = payload.new as Record<string, unknown>;
          const { data: p } = await supabase
            .from('profiles')
            .select('nickname, avatar_url, grade')
            .eq('id', m.author_id as string)
            .single();
          setMessages((prev) => [
            ...prev,
            {
              id: m.id as number,
              author_id: m.author_id as string,
              content: m.content as string,
              created_at: m.created_at as string,
              is_anonymous: m.is_anonymous as boolean,
              profiles: p,
              is_mine: m.author_id === currentUser?.id,
            },
          ]);
          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [room, currentUser]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !currentUser || !room) return;
    const c = input.trim();
    setInput('');
    const { error } = await supabase.from('discussion_messages').insert({
      room_id: room.id,
      author_id: currentUser.id,
      content: c,
      is_anonymous: false,
      message_type: 'text',
    });
    if (error) setInput(c);
  }, [input, currentUser, room]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const displayName = room?.display_name ?? roomKey;

  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--bg-base)', height: '100dvh' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b px-4 py-3"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="뒤로가기"
            style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </h1>
            {room?.description && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {room.description}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 ? 'flex-row-reverse' : ''}`}>
                <div className="skeleton w-7 h-7 rounded-full shrink-0" />
                <div className="skeleton h-10 w-44 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 gap-3">
            <span className="text-4xl">💬</span>
            <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
              첫 번째 메시지를 남겨보세요! 💬
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const username = msg.is_anonymous ? '익명' : (msg.profiles?.nickname ?? '익명');
            return (
              <div
                key={msg.id}
                className={`flex gap-2 items-end ${msg.is_mine ? 'flex-row-reverse' : ''}`}
              >
                {!msg.is_mine && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: 'var(--brand)', color: 'var(--text-inverse)' }}
                  >
                    {username[0]}
                  </div>
                )}
                <div className={`flex flex-col gap-0.5 max-w-[76%] ${msg.is_mine ? 'items-end' : 'items-start'}`}>
                  {!msg.is_mine && (
                    <span className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>
                      {username}
                    </span>
                  )}
                  <div
                    className="px-3 py-2 text-sm leading-relaxed break-words"
                    style={
                      msg.is_mine
                        ? {
                            backgroundColor: 'var(--brand)',
                            color: 'var(--text-inverse)',
                            borderRadius: '16px 16px 4px 16px',
                          }
                        : {
                            backgroundColor: 'var(--bg-hover)',
                            color: 'var(--text-primary)',
                            borderRadius: '16px 16px 16px 4px',
                          }
                    }
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>
                    {fmtTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className="border-t px-3 py-2"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {!currentUser ? (
          <div className="text-center py-3" style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
            메시지를 보내려면 로그인하세요
          </div>
        ) : (
          <div
            className="flex gap-2 items-end rounded-2xl border px-3 py-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-base)' }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="메시지를 입력하세요..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm"
              style={{ color: 'var(--text-primary)', minHeight: 24, maxHeight: 100 }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              aria-label="메시지 전송"
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all"
              style={{
                backgroundColor: input.trim() ? 'var(--brand)' : 'var(--bg-hover)',
                color: input.trim() ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              }}
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
